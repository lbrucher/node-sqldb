const createInterface = require('./create-interface');
const simpleLogger = require('../simple-logger');

const proto = createInterface([
  // initialize(options): void 
  //   options: { logger }
  //   logger is an object exposing the following methods: trace, debug, info, warn, error
  'initialize',

  // shutdown(): void 
  'shutdown',

  // getClient(): Client
  //   return a client connection to the DB
  'getClient',

  // releaseClient(client): void
  'releaseClient',

  // query(client, sql, params): []
  //   sql: query string
  //   params: object containing the param values associated with the query
  //   return an array of rows, or [] when the query returned no data
  'query',

  // exec(client, sql, params): number
  //   sql: query string
  //   params: object containing the param values associated with the query
  //   return the number of rows affected by the query
  'exec',


  // startTransaction(client, isolation_level): void 
  //   isolation_level is specific to the driver and used by the client when invoking 
  //   the node-sqldb.db's exported methods (use, useWithRetry, query, exec, etc.)
  'startTransaction',

  // commitTransaction(client)
  //   optional, defaults to: client.query('COMMIT')
  //'commitTransaction',

  // rollbackTransaction(client)
  //   optional, defaults to: client.query('ROLLBACK')
  //'rollbackTransaction',


  // ensureMigrationsTable(migrationsTableName)
  //   create the migrations table if it does not exist yet, otherwise does nothing
  'ensureMigrationsTable',

  // listExecutedMigrationNames(migrationsTableName)
  //   return the list of completed migrations names, ordered by name ASC
  'listExecutedMigrationNames',

  // logMigrationSuccessful(conn, migrationsTableName, migrationName)
  //   mark the given migration as completed, i.e. insert a new record into the migration table 
  'logMigrationSuccessful',

  // getMigrationTransactionIsolationLevel()
  //   return the transaction isolation level to be used during migrations 
  'getMigrationTransactionIsolationLevel',
]);


// Add a default simple logger
proto.logger = simpleLogger;

// Expose the transaction isolation levels (optional).
proto.txIsolationLevels = {};


module.exports = proto;
