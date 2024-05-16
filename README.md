# Convenience library to work with SQL in NodeJS apps

Also see [samples](samples/)


## Usage

```
const { db } = require('node-sqldb');
const PG = require('node-sqldb-pg');

// We'll be using the Postgres driver
const dbOptions = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'xxx',
  database: 'app-db',
  poolSize: 10
};
const driver = new PG(dbOptions);

// Init the DB
await db.initialize(driver);


// Then run some queries
//
// No transaction
const rows = await db.use(async (conn) => {
  const rows = await conn.query("SELECT * FROM users");
  // ...
  return rows;
});

// OR
const rows = await db.query(null, "SELECT * FROM users");

// Transaction Read Committed
// 'RC' is actually defined in the Driver (PG in this case)
await db.use(db.txIsolationLevels.RC, async (conn) => {
  await conn.exec("INSERT INTO cart(name,value) VALUES($1, $2)", ["item1", 1]);
})

// OR
await db.exec(db.txIsolationLevels.RC, "INSERT INTO cart(name,value) VALUES($1, $2)", ["item1", 1]);

// Note that in both cases the transaction will be automatically committed/rolled back before db.use() or db.exec() return.
```

## API

### `> txIsolationLevels`

Object containing the various possible transaction isolation levels.
Those levels are defined by the driver and exposed here for convenience.

For instance, the Postgres driver (`node-sqldb-pg`) exposes the following levels: `RC` (Read Committed), `RR` (Repeatable Read) and `SER` (Serializable)


### `> initialize(driver, options={})`

Initializes the DB module with the given `driver` and `options`.

`driver` is a database engine driver whose prototype is exported as `driverPrototype`. For instance, see the `node-sqldb-pg` Postgres driver.

`options` can contain the following fields:

* `runMigrations`: boolean to indicate if migrations should be executed during initialization (default: false)
* `logger`: object used for logging and exposing the following functions: `trace`,`debug`,`info`,`warn`,`error` (default: internal simple logger)


### `> shutdown()`

Shutdown the DB module.


### `> runMigrations()`

*TODO*


### `> use(conn|tx_isolation, fnExecution)`

Get a connection from the DB and invoke `fnExecution(conn)` where you can describe what to do with that connection.

Will return whatever `fnExecution` returns.

`conn` (optional) = there are case where you might already have a connection but unsure about it. You could thus do: `await db.use(conn||'rr', ...)`

`tx_isolation` (optional), null for no transaction, otherwise provide a string that the DB driver understands to specify the type of transaction to use.

`fnExecution` = `async (conn) => { ... }`

`conn` has the following functions:

* `query(sql, params)`: return the array of rows from the given query on the DB
* `querySingle(sql, params)`: similar to `query()` but only return the first row or `null` if the query did not return any row.
* `exec(sql, params)`: execute the given query and return the number of affected rows. `sql` can also be an array of SQL strings, which will be executed in sequence. `params` is not used in that case and there is no return value.
* `commit()`: commit the transaction. Does nothing if the query is not executed within a transaction.
* `rollback(err)`: roll back the transaction. Does nothing if the query is not executed within a transaction.


`use()` will automatically commit or roll back the transaction (when a transaction has actually been started) upon success or failure. In case of failure and after rollback has been invoked, the original exception will be propagated:

```
try {
	await db.use('rr', async (conn) => {
		throw 'boo';
	});
}
catch(err){
	// transaction has been rolled back and err === 'boo'
}
```

`use(tx_isolation, async (conn) => { ... })` also manages retrieving and releasing client connections with the DB (the actual DB connection is wrapped inside `conn`).
Client connections can come from a DB pool or not, that is up to the driver to manage.


#### Examples

```
// No transactions
// Both constructs are the same
await db.use(null, async (conn) => { ... });
await db.use(async (conn) => { ... });

// With transactions
const data = await db.use(db.txIsolationLevels.RR, async (conn) => {
  const rows = await conn.query("SELECT * FROM users");
  if (rows.length === 0) {
    await conn.exec("INSERT INTO users(name,address) VALUES($1,$2)", newUser.name, newUser.address);

    // This is not required as the transaction will automatically be committed after this function ends.
    await conn.commit();
  }

  return "ok";
});

// data === "ok"
```

### `> useWithRetry`

*TODO*

### `> query(conn|tx_isolation, sql, params)`

Shortcut to this:

```
await db.use(conn|tx_isolation, async (conn) => {
  return await conn.query(sql, params);
});
```

### `> querySingle`

Same as `query()` above but only return the first row or null when no data is returned by the query.


### `> exec`

Shortcut to this:

```
await db.use(conn|tx_isolation, async (conn) => {
  return await conn.exec(sql, params);
});
```

Similar to `conn.exec()`, `sql` could be an array of SQL strings (`params` unused in that case)


### `> retryableQuery`

*TODO*

### `> retryableExec`

*TODO*



## Creating a new driver

Along with exposing the `db` object, this library also exposes [`driverPrototype`](lib/driver/driver-prototype.js), the "interface" any driver must implement.

A driver implementation must export a constructor function whose prototype is `driverPrototype`.

```
function MyDriver(options) {
  ...

  // Implement whatever 'driverPrototype' defines:
  this.txIsolationLevels = { ... };

  this.initialize = async function(opts) {
  }

  this.shutdown = async function() {
  }

  this.getClient = async function() {
  }

  this.releaseClient = async function(client) {
  }

  this.query = async function(client, sql, params) {
  }

  this.exec = async function(client, sql, params) {
  }

  this.startTransaction = async function(client, tx_isolation_level) {
  }

  // Optional
  // this.commitTransaction = async function (client) {
  // }

  // Optional
  // this.rollbackTransaction = async function(client) {
  // }

  this.ensureMigrationsTable = async function (migrationsTableName) {
  }

  this.listExecutedMigrationNames = async function(migrationsTableName) {
  }

  this.logMigrationSuccessful = async function(conn, migrationsTableName, migrationName) {
  }
  
  this.getMigrationTransactionIsolationLevel = function() {
  }
}

Object.assign(MyDriver.prototype, driverPrototype);
module.exports = MyDriver;
```

The code that wants to use that driver will do so this way:

```
const { db } = require('node-sqldb');
const MyDriver = require(...);

const myDriver = new MyDriver(...);
await db.initialize(myDriver, ...);
```

