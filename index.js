'use strict';
const assert = require('assert');

const NOOP = function noop () {}


class MigrationEngine {
    constructor (options) {
        const actualOptions = options || {};
        if (actualOptions.loadState) {
            assert.equal(typeof actualOptions.loadState, 'function', '"options.loadState" must be a function');
        }
        if (actualOptions.saveState) {
            assert.equal(typeof actualOptions.saveState, 'function', '"options.saveState" must be a function');
        }

        this.options = Object.assign({}, actualOptions);
        this.migrations = [];
    }

    define (version, name, funcs) {
        assert.ok(Number.isInteger(version), '"version" must be an integer');
        assert.equal(typeof name, 'string', '"name" must be a string');
        assert.equal(typeof funcs.upgrade, 'function', '"funcs.upgrade" must be a function');
        assert.equal(typeof funcs.downgrade, 'function', '"funcs.downgrade" must be a function');

        this.migrations.push({'version': version, 'name': name, 'funcs': funcs});
    }

    upgrade (toVersion) {
        const targetVersion = toVersion || +Infinity;
        return this._loadState().then(state => {
            const fromVersion = state.last_version || 0;

            const sortedMigrations = this.migrations.sort((a, b) => a.version - b.version);
            const filteredMigrations = sortedMigrations.filter(m => m.version > fromVersion && m.version <= targetVersion);


            const migrationPromise = (idx) => {
                if (!(idx in filteredMigrations)) return Promise.resolve();
                const p = Promise.resolve(filteredMigrations[idx].funcs.upgrade());
                return p.then(migrationPromise(idx + 1));
            };

            return migrationPromise(0).then(() => filteredMigrations[filteredMigrations.length - 1].version);
        }).then(lastVersion => {
            return this._saveState({'last_version': lastVersion}).then(() => lastVersion);
        });
    }

    downgrade (toVersion) {
        const targetVersion = toVersion || -Infinity;
        return this._loadState().then(state => {
            const fromVersion = state.last_version || 0;

            const sortedMigrations = this.migrations.sort((a, b) => b.version - a.version);
            const filteredMigrations = sortedMigrations.filter(m => m.version <= fromVersion && m.version > targetVersion);


            const migrationPromise = (idx) => {
                if (!(idx in filteredMigrations)) return Promise.resolve();
                const p = Promise.resolve(filteredMigrations[idx].funcs.downgrade());
                return p.then(migrationPromise(idx + 1));
            };

            return migrationPromise(0).then(() => filteredMigrations[filteredMigrations.length - 1].version - 1);
        }).then(lastVersion => {
            return this._saveState({'last_version': lastVersion}).then(() => lastVersion);
        });
    }

    _loadState () {
        const loadStateFunc = this.options.loadState || NOOP;
        return Promise.resolve(loadStateFunc()).then(s => s || {});
    }

    _saveState (state) {
        const saveStateFunc = this.options.saveState || NOOP;
        return Promise.resolve(saveStateFunc(state));
    }
}


module.exports = function migration (options) {
    return new MigrationEngine(options);
}
