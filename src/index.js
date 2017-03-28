import assert from 'assert'

function NOOP () {}

class MigrationEngine {
    constructor (options = {}) {
        assert.equal(typeof options.loadState, 'function', '"options.loadState" must be a function');
        assert.equal(typeof options.saveState, 'function', '"options.saveState" must be a function');
        assert.equal(typeof options.setup, 'function', '"options.setup" must be a function');
        assert.equal(typeof options.teardown, 'function', '"options.teardown" must be a function');

        this.options = Object.assign({}, options);
        this.migrations = [];
    }

    define (version, name, funcs) {
        assert.ok(Number.isInteger(version) && version < Number.MAX_SAFE_INTEGER, '"version" must be a safe integer');
        assert.equal(typeof name, 'string', '"name" must be a string');
        assert.equal(typeof funcs.upgrade, 'function', '"funcs.upgrade" must be a function');
        assert.equal(typeof funcs.downgrade, 'function', '"funcs.downgrade" must be a function');

        this.migrations.push({'version': version, 'name': name, 'funcs': funcs});
    }

    async upgrade (targetVersion = +Infinity) {
        const context = {};
        await this._setup(context);

        const state = await this._loadState(context);
        const fromVersion = state.last_version || 0;

        const sortedMigrations = this.migrations.sort((a, b) => a.version - b.version);
        const filteredMigrations = sortedMigrations.filter(m => m.version > fromVersion && m.version <= targetVersion);

        let lastVersion = fromVersion;
        try {
            for (let mig of filteredMigrations) {
                await mig.funcs.upgrade(context);
                lastVersion = mig.version;
            }

            return lastVersion;
        } finally {
            await this._saveState(context, {'last_version': lastVersion});
            await this._teardown(context);
        }
    }

    async downgrade (targetVersion = -Infinity) {
        const context = {};
        await this._setup(context);

        const state = await this._loadState(context);
        const fromVersion = state.last_version || 0;

        const sortedMigrations = this.migrations.sort((a, b) => b.version - a.version);
        const filteredMigrations = sortedMigrations.filter(m => m.version <= fromVersion && m.version > targetVersion);

        let lastVersion = fromVersion;
        try {
            for (let mig of filteredMigrations) {
                await mig.funcs.downgrade(context);
                lastVersion = mig.version - 1;
            }

            return lastVersion;
        } finally {
            await this._saveState(context, {'last_version': lastVersion});
            await this._teardown(context);
        }
    }

    async _setup (context) {
        const setupFunc = this.options.setup || NOOP;
        return await setupFunc(context);
    }

    async _teardown (context) {
        const teardownFunc = this.options.teardown || NOOP;
        return await teardownFunc(context);
    }

    async _loadState () {
        const loadStateFunc = this.options.loadState || NOOP;
        const state = await loadStateFunc();
        return state || {};
    }

    async _saveState (state) {
        const saveStateFunc = this.options.saveState || NOOP;
        return await saveStateFunc(state);
    }
}


export default function (options) {
    return new MigrationEngine(options);
}
