

// The connection wrapper is the one exposed to users of this library.
// Carefully determine what functions are exposed here.
module.exports = async function(driver, client, tx_isolation_level, logger) {

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
      logger.error("Error performing DB query [%s]: ", sql, err);
      throw err;
    }
  };


  // querySingle('', []) === query('', [])[0]
  // return 1 single record/row or null if there were no data
  wrapper.querySingle = async function(sql, params) {
    const data = await wrapper.query(sql, params);
    return data.length === 0 ? null : data[0];
  }


  // exec([]) or exec('', []) or exec('')
  // return row_count or [row_counts]
  wrapper.exec = async function(sqls, params){
    if (Array.isArray(sqls)){
      const numRows = [];
      for(const sql of sqls){
        numRows.push( await driver.exec(client, sql) );
      }
      return numRows;
    }
    else{
      const numRows = await driver.exec(client, sqls, params);
      return numRows;
    }
  };



  // No transaction means noop commit() and rollback()
  if (tx_isolation_level == null){
    wrapper.rollback = async function(err){}
    wrapper.commit = async function(){}
  }
  else {
    // rollback(err, rethrow);
    wrapper.rollback = async function(err){
      // Prevents double rollbacks
      if (wrapper._ended){
        return;
      }

      try{
        if (wrapper.enableTraceLog){
          logger.trace("Rolling back transation because of: ", err);
        }

        if (driver.rollbackTransaction == null){
          await client.query('ROLLBACK');
        }
        else {
          await driver.rollbackTransaction(client, err);
        }

        wrapper._ended = true;
      }
      catch(err){
        logger.error("Error rolling back transation: ", err);
        throw err;
      }
    };


    // commit()
    wrapper.commit = async function(){
      // Prevents double commits
      if (wrapper._ended){
        return;
      }

      try{
        logger.trace("Committing transation");
        if (driver.commitTransaction == null){
          await client.query('COMMIT');
        }
        else {
          await driver.commitTransaction(client);
        }

        // We set this ONLY once the commit actually was successful!
        // This allows for issuing a ROLLBACK in case the COMMIT failed.
        wrapper._ended = true;
      }
      catch(err){
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
