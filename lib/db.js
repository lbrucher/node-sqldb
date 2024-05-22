'use strict';
const simpleLogger = require('./simple-logger');
const noopLogger = require('./noop-logger');
const ConnectionManager = require('./connection-manager');
const Migrations = require('./migrations');
const driverPrototype = require('./drivers/driver-prototype');

let _driver;
let _connectionManager;
let _logger;



function validateDriver(driver) {
  const missingFuncNames = driverPrototype._getMissingPrototypeFunctions(driver, driverPrototype);
  if (missingFuncNames.length > 0) {
    throw new Error(`Invalid DB driver, the following driver prototype functions are not found: ${missingFuncNames.join(', ')}!`);
  }
}

// Default empty. Will be filled in during initialization once we know the driver.
exports.txIsolationLevels = {};


exports.initialize = async function(driver, { logger, runMigrations }={}) {
  _driver = driver;

  if (logger === undefined){
    _logger = simpleLogger;
  }
  else if (logger === null){
    _logger = noopLogger;
  }
  else {
    _logger = logger;
  }

  _logger.info("Initializing DB...");

	if (!!_connectionManager){
		throw new Error('DB already initialized!');
  }

  // Check valid driver
  validateDriver(_driver);

  // Initialize driver
  await _driver.initialize({logger:_logger});

  // Create our connection manager
  _connectionManager = ConnectionManager(_driver, {logger:_logger});

  // Expose the driver's transaction levels
  exports.txIsolationLevels = driver.txIsolationLevels;

  // Auto run migrations if specified
  if (!!runMigrations) {
    await exports.runMigrations();
  }
}


exports.shutdown = async function() {
	if (!!_connectionManager){
    await _connectionManager.shutdown();
  }

  _connectionManager = null;
}


exports.runMigrations = async function() {
	if (!_connectionManager){
		throw new Error('DB not initialized!');
  }

  await Migrations(_connectionManager, {logger:_logger});
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
  exports[method] = async function() { return await _connectionManager[method](...arguments) }
}
