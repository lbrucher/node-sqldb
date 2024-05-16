'use strict';

module.exports = function(connectionManager) {

  function run(kind) {
    return async function() {
        // await ensureMigrationsTable();

        // const engine = MigrationsEngine({
        //     listAllMigrationNames,
        //     listExecutedMigrationNames,
        //     logger,
        //     execMigration
        // });

        // await engine[kind]();
    }
  }


  return {
      up: run('up'),
      down: run('down')
  };

}