'use strict';
const simpleLogger = require('./simple-logger');
const ConnectionManager = require('./connection-manager');
const Migrations = require('./migrations');
const driverPrototype = require('./drivers/driver-prototype');

let connectionManager;
let log;



function validateDriver(driver) {
  const missingFuncNames = driverPrototype._getMissingPrototypeFunctions(driver, driverPrototype);
  if (missingFuncNames.length > 0) {
    throw new Error(`Invalid DB driver, the following driver prototype functions are not found: ${missingFuncNames.join(', ')}!`);
  }
}


exports.initialize = async function(driver, { runMigrations=false, logger=null }) {
  log = logger | simpleLogger;
  log.info("Initializing DB...");

	if (!!connectionManager){
		throw new Error('DB already initialized!');
  }

  // Check valid driver
  validateDriver(driver);

  // Initialize driver
  await driver.initialize({logger:log});

  // Create our connection manager
  connectionManager = ConnectionManager(driver, {logger});

  // Auto run migrations if specified
  if (runMigrations) {
    await exports.runMigrations();
  }
}


exports.shutdown = async function() {
	if (!!connectionManager){
    await connectionManager.shutdown();
  }

  connectionManager = null;
}


exports.runMigrations = async function() {
	if (!connectionManager){
		throw new Error('DB not initialized!');
  }

  await Migrations(connectionManager).up();
}



const exportableMethods = [
  'use',
  'useWithRetry',
  'query',
  'querySingle',
  'exec',
  'retryableQuery',
  'retryableExec'
]
for(const method of exportableMethods) {
  exports[method] = async function() { return await connectionManager[method](...arguments) }
}
// exports.use            = async function() { return await connectionManager.use(...arguments) }
// exports.useWithRetry   = async function() { return await connectionManager.useWithRetry(...arguments) }
// exports.query          = async function() { return await connectionManager.query(...arguments) }
// exports.querySingle    = async function() { return await connectionManager.querySingle(...arguments) }
// exports.exec           = async function() { return await connectionManager.exec(...arguments) }
// exports.retryableQuery = async function() { return await connectionManager.retryableQuery(...arguments) }
// exports.retryableExec  = async function() { return await connectionManager.retryableExec(...arguments) }




// if (process.env['NODE_ENV'] === 'test') {
// 	exports.dropAllData = async function() {
// 		if (connectionManager == null || db_pool == null)
// 			throw new Error('DB not initialized!');
	
// 		await connectionManager.exec('rr', [
// 			'DELETE FROM tfe_notifications',
// 			'DELETE FROM long_run_processes',
// 			'DELETE FROM workspaces',
// 			'DELETE FROM projects',
// 			'DELETE FROM blueprints',
// 			'DELETE FROM estates'
// 		]);
// 	}
// }
