'use strict';
const Utils = require('./utils');


module.exports = function(driver, { logger, delay_before_retry_connection=500, max_retry_connection_attempts=3 }){

	async function createConnectionWrapper(client, tx_isolation_level){
		let wrapper = {
			enableTraceLog: true,
			_ended: false,
		};

    // query('', [])
		// return rows
		wrapper.query = async function(sql, params){
			try {
        const rows = await driver.query(client, sql, params);
        return rows;
			}
			catch(err){
				// // tx error
				// if (err.code === '40001'){
				// 	logger.warn("Error performing DB query [%s]: tx serialization error", sql);
				// }
				// else{
				// 	logger.error("Error performing DB query [%s]: ", sql, err);
				// }
				logger.error("Error performing DB query [%s]: ", sql, err);
				throw err;
			}
		};

		wrapper.querySingle = async function(sql, params) {
			const data = await wrapper.query(sql, params);
			return data.length === 0 ? null : data[0];
		}

		// exec([]) or exec('', []) or exec('')
		// return row_count
		wrapper.exec = async function(sqls, params){
			if (Array.isArray(sqls)){
				for(const sql of sqls){
//					await wrapper.query(sql);
          await driver.exec(client, sql);
        }
			}
			else{
				// const rows = await wrapper.query(sqls, params);
				// return rows.length;
        const nRows = await driver.exec(client, sqls, params);
        return nRows;
      }
		};



    // No transaction means noop commit() and rollback()
		if (tx_isolation_level == null){
			wrapper.rollback = async function(err){}
			wrapper.commit = async function(){}
      return;
		}
		else {
			// rollback(err);
			wrapper.rollback = async function(err){
				if (wrapper._ended)
					return;

				wrapper._ended = true;
				try{
					if (wrapper.enableTraceLog){
						logger.trace("Rolling back transation because of: ", err);
          }

          if (driver.rollbackTransaction == null){
            await client.query('ROLLBACK');
          }
          else {
            await driver.rollbackTransaction(client);
          }
				}
				catch(err){
					logger.error("Error rolling back transation: ", err);
//TODO ?? rethrow err ??
				}
			};

			// commit()
			wrapper.commit = async function(){
				if (wrapper._ended)
					return;

				wrapper._ended = true;
				try{
					logger.trace("Committing transation");
          if (driver.commitTransaction == null){
            await client.query('COMMIT');
          }
          else {
            await driver.commitTransaction(client);
          }
				}
				catch(err){
					// if (err.code === '40001')
					// 	logger.warn("Error committing transaction: tx serialization error");
					// else
					// 	logger.error("Error committing transation: ", err);
					logger.error("Error committing transation: ", err);
					throw err;
				}
			};


      // setup transaction
      try {
        await driver.startTransaction(client, tx_isolation_level)
			}
			catch(err) {
				logger.error("Error starting new transaction: ", err);
				throw err;
			}
		}


		return wrapper;
	}


	/*
	 * tx_isolation_level = null for no transaction support
	 * fnExec(client)
	 */
	async function useConnection(conn_or_tx_isolation_level, fnExec){
		let conn;
		let tx_isolation_level;
		let client;
		let res;

		// useConnection(fn)
		if (fnExec === undefined) {
			if (conn_or_tx_isolation_level == null || typeof conn_or_tx_isolation_level !== 'function'){
				throw new Error('Missing arguments for useConnection()!');
      }

      conn = null;
			tx_isolation_level = null;
			fnExec = conn_or_tx_isolation_level;
		}
		// useConnection('rc', fn)
		else if (typeof conn_or_tx_isolation_level === 'string') {
			tx_isolation_level = conn_or_tx_isolation_level;
			conn = null;
		}
		// useConnection(conn, fn)
		else {
			conn = conn_or_tx_isolation_level;
			tx_isolation_level = null;
		}

		let conn_created_here = false;

		try {
			// Keep this block inside the try...finally because we get the client here and it gets released in the finally block!
			if (conn == null) {
				conn_created_here = true;
				client = await driver.getClient();
				conn = await createConnectionWrapper(client, tx_isolation_level);
			}

			// do something with the connection
			res = await fnExec(conn);

			// commit the transaction
			if (conn_created_here){
				await conn.commit();
      }
		}
		catch(err) {
//console.log("USE-CONNECTION ERROR: ", conn_created_here, err);
			//logger.error("Error using DB connection (rolling back tx): ", err);
			if (conn && conn_created_here){
				await conn.rollback();
      }

//console.log("USE-CONNECTION -- rethrowing");
			throw err;
		}
		finally {
			if (client && conn_created_here){
				await driver.releaseClient(client);
      }
		}

		return res;
	}



	/*
	 * same as useConnection() but is the commit fails, it'll be retried
	 * fn(client), client.done(err) when done
	 * callback(err)
	 */
	async function useRetryableConnection(conn_or_tx_isolation_level, fnExec){
		let conn;
		let old_conn_commit;
		let tx_err;

		// useConnection(fn)
		if (fnExec === undefined) {
			if (conn_or_tx_isolation_level == null || typeof conn_or_tx_isolation_level !== 'function'){
				throw new Error('Missing arguments for useConnection()!');
      }
			fnExec = conn_or_tx_isolation_level;
		}
		// useConnection(conn, fn)
		else if (typeof conn_or_tx_isolation_level !== 'string') {
			conn = conn_or_tx_isolation_level;
			old_conn_commit = conn.commit;
		}


		async function doit(){
			tx_err = null;
			return await useConnection(conn_or_tx_isolation_level, async (conn) => {
				// Redefine the conn.commit() in order to retry failures
				const conn_commit = conn.commit;
				conn.commit = async function(){
					try {
						await conn_commit();
					}
					catch(err){
						// do not throw, just pretend it worked ok but do record the error in tx_err
						// so it can be handled later
						tx_err = err;
					}
				};

				return await fnExec(conn);
			});
		}

		try {
			let attempts_remaining = max_retry_connection_attempts;
			let result;
			do {
				attempts_remaining--;
				try {
					result = await doit();
				}
				catch(err){
					tx_err = err;
				}

				if (tx_err == null) {
					return result;
				}
				else if (attempts_remaining <= 0) {
					logger.error("Retried executing db transaction too many times, aborting: ", tx_err);
					throw tx_err;
				}
				else {
					logger.warn("DB transaction error, wait a bit and retry (%d attempts left): ", attempts_remaining, tx_err);
					await Utils.wait(delay_before_retry_connection);
				}
			} while (true);
		}
		finally {
			if (old_conn_commit){
				conn.commit = old_conn_commit;
      }
		}
	}


	async function useConnectionAndQuery(conn_or_tx_level, sql, params) {
		return await useConnection(conn_or_tx_level, async (conn) => {
			return await conn.query(sql, params);
		});
	}

	async function useConnectionAndQuerySingle(conn_or_tx_level, sql, params) {
		return await useConnection(conn_or_tx_level, async (conn) => {
			return await conn.querySingle(sql, params);
		});
	}

	async function useConnectionAndExec(conn_or_tx_level, sqls, params) {
		return await useConnection(conn_or_tx_level, async (conn) => {
			return await conn.exec(sqls, params);
		});
	}

	async function useRetryableConnectionAndQuery(conn_or_tx_level, sql, params) {
		return await useRetryableConnection(conn_or_tx_level, async (conn) => {
			return await conn.query(sql, params);
		});
	}

	async function useRetryableConnectionAndExec(conn_or_tx_level, sqls, params) {
		return await useRetryableConnection(conn_or_tx_level, async (conn) => {
			return await conn.exec(sqls, params);
		});
	}


  async function shutdown() {
    await driver.shutdown();
  }


  return {
		use:            useConnection,
		useWithRetry:   useRetryableConnection,
		query:          useConnectionAndQuery,
		querySingle:    useConnectionAndQuerySingle,
		exec:           useConnectionAndExec,
		retryableQuery: useRetryableConnectionAndQuery,
		retryableExec:  useRetryableConnectionAndExec,

    shutdown:       shutdown,
    getDriver:      () => driver
  };
}
