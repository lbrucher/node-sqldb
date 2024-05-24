const createInterface = require('./create-interface');
const simpleLogger = require('../simple-logger');

const proto = createInterface([
  // async initialize(options): void 
  //   options: { logger }
  //   logger is an object exposing the following methods: trace, debug, info, warn, error
  'initialize',

  // async shutdown(): void 
  'shutdown',

  // async getClient(): Client
  //   return a client connection to the DB
  'getClient',

  // async releaseClient(client): void
  //   release the connection (or return it to the pool)
  'releaseClient',

  // async query(client, sql, params): []
  //   sql: query string
  //   params: object containing the param values associated with the query
  //   return an array of rows, or [] when the query returned no data
  'query',

  // async exec(client, sql, params): number
  //   sql: query string
  //   params: object containing the param values associated with the query
  //   return the number of rows affected by the query
  'exec',


  // async startTransaction(client, isolation_level): void 
  //   isolation_level is specific to the driver and specified by the client when invoking 
  //   the use-db.db's exported methods (use, useWithRetry, query, exec, etc.)
  'startTransaction',

  // async commitTransaction(client)
  //   optional, defaults to: client.query('COMMIT')
  //'commitTransaction',

  // async rollbackTransaction(client, err)
  //   optional, defaults to: client.query('ROLLBACK')
  //'rollbackTransaction',


  // async ensureMigrationsTable(migrationsTableName): void
  //   create the migrations table if it does not exist yet, otherwise does nothing
  'ensureMigrationsTable',

  // async listExecutedMigrationNames(migrationsTableName): []
  //   return the list of completed migrations names, ordered by name ASC
  'listExecutedMigrationNames',

  // async logMigrationSuccessful(conn, migrationsTableName, migrationName): void
  //   mark the given migration as completed, i.e. insert a new record into the migration table 
  'logMigrationSuccessful',

  // getMigrationTransactionIsolationLevel(): string
  //   return the transaction isolation level to be used during migrations 
  'getMigrationTransactionIsolationLevel',
]);


// Add a default simple logger
proto.logger = simpleLogger;

// Expose the transaction isolation levels (optional).
proto.txIsolationLevels = {};


module.exports = proto;
