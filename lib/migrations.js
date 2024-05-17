'use strict';
const fs = require('fs/promises');
const Path = require('path');
const simpleLogger = require('./simple-logger');


module.exports = async function(connectionManager, {migrationsTableName, migrationsDir, logger} = {}) {
  migrationsTableName = migrationsTableName || 'migrations';
  migrationsDir = migrationsDir || Path.join(__dirname, 'migrations');
  logger = logger || simpleLogger;

  const driver = connectionManager.getDriver();


  async function listAllMigrationNames() {
    const files = await fs.readdir(migrationsDir, {withFileTypes:true});
    return files.filter(f => (f.isFile() && f.name.toLowerCase().endsWith('.js'))).map(f => f.name.toLowerCase());
  }

  async function execMigration(name) {
    const migration = require( Path.join(migrationsDir, name) );

    await connectionManager.use(driver.getMigrationTransactionIsolationLevel(), async (conn) => {
      await migration(conn);
      await driver.logMigrationSuccessful(conn, migrationsTableName, name);
    });
  }

  async function execMigrations() {
    await driver.ensureMigrationsTable(migrationsTableName);

    const all_names = await listAllMigrationNames();
    const executed_names = await driver.listExecutedMigrationNames(migrationsTableName);
  
    const migrations_to_execute = all_names.filter(name => !executed_names.includes(name));
    if (migrations_to_execute.length === 0) {
      logger.info(`No migrations to execute`);
      return;
    }
  
    for(const name of migrations_to_execute) {
      logger.info(`Executing migration <${name}>...`);
      try {
        await execMigration(name);
      }
      catch(err) {
        logger.error(err);
        return;
      }
    }
  
    logger.info("Migrations complete.");
  };
  

  await execMigrations();
}
