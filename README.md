# Node Generic Migrations

A promise-based generic migration library for Node.js `>= 6`.

## Why?

After looking for a simple migration library for a while, all I found were very opinionated
libraries with no support for promises that either forced a storage system or a directory structure
on you.  Instead, `generic-migrations` gives you a public interface with which you can define how
you load and store state, how you set up and tear down your environment and all your migrations.
Whether you use separate files in a directory or not, store state in a file or in a database, or
any other detail is completely up to you.

## Installation

    $ npm install --save generic-migrations

## Example

```jvascript
import migrations from 'generic-migrations';

const migr = migrations({
    async setup (context) {
        /* connect to your DB, etc. */
        context.db = await connectToDatabase();
    },

    async teardown (context) {
        /* close DB connection, etc */
        await context.db.close();
    },

    async loadState (context) {
        /* load your state */
        return await context.db.findOne(/* ... */);
    },

    async saveState (context, state) {
        /* save your state */
        await context.db.replaceOne(/* ... */);
    },
});

/* For each version ... */
migr.define(1, 'first-migration', {
    async upgrade (context) {
        /* Upgrade to version 1 */
    },

    async downgrade (context) {
        /* Downgrade from version 1 */
    },
});

/* Run the migrations */
(async () => {
    migr.upgrade();
});
```

### API

#### `createMigration(functions)` (default export)

Creates a new empty `Migration` with the given lifecycle `functions`.

  - `functions`: Object with the following attributes:
      - `setup(context)`: _(Optional)_  Function that sets up your environment, returns a Promise.
        The `context` attribute is an object that will be passed around for all user-defined
        functions; modify it at will.
      - `teardown(context)`: _(Optional)_  Function that tears down your environment, returns a
        Promise.  The `context` attribute is the same as the one given to `setup`.
      - `loadState(context)`: _(Optional)_  Function that loads the state, returns a Promise to the
        state.  The promise might resolve to `null` or `undefined` if no state is available.
        The `context` attribute is the same as the one given to `setup`.
      - `saveState(context, state)`: _(Optional)_  Function that saves the state, returns a Promise.
        The `context` attribute is the same as the one given to `setup`; the `state` argument should
        be stored unmodified in whatever storage system you want.

#### `Migration#define(version, name, functions)`

Defines a new version for your migration.

  - `version`: Integer defining the version.  Must be unique for this migration.
  - `name`: Migration name.  Used only for logging and other human-oriented processes.
  - `functions`: Object with the following attributes:
      - `upgrade(context)`:  Function that performs an upgrade to this version, returns a Promise.
        The `context` attribute is the same as the one given to `setup`.
      - `downgrade(context)`:  Function that performs a downgrade from this version, returns a
        Promise.  The `context` attribute is the same as the one given to `setup`.

#### `Migration#upgrade(targetVersion = +Infinity)`

Performs an upgrade to `targetVersion`.  Returns a promise that will resolve to the last version
that was upgraded to.  See [the section on error handling](#error-handling) for more information.

  - `targetVersion`:  Target version for the upgrade.  If not provided, upgrades to the latest
    defined version.

    Note that the saved state will remember only the last version up to the latest *defined*
    one.  For example, if only versions `1` and `5` are available and you call `upgrade(10)`, the
    current version will be `5`, and later adding versions `3` and `7` will trigger an upgrade for
    version `7` but not `3`.

#### `Migration#downgrade(targetVersion = -Infinity)`

Performs a downgrade to `targetVersion`.  Returns a promise that will resolve to one less than the last version that was downgraded from.  See [the section on error handling](#error-handling) for more information.

- `targetVersion`:  Target version for the downgrade.  If not provided, downgrades to the earliest
  defined version.

  Note that the saved state will remember only the last version up to the earliest *defined*
  one.  For example, if only versions `4` and `6` are available and you call `downgrade(0)`, the
  current version will be `3`, and later adding versions `1` and `5` will trigger an downgrade for
  version `1` but not `6`.


## Error Handling

> TODO
