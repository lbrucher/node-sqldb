'use strict';
const express = require('express');
const { db } = require('../');
const logger = require('./lib/logger');
const Path = require('path');

const driverNames = ['pg', 'mysql'];
const driverName = process.argv[2];
let User;


async function initialize() {
  // validate driver
  if (!driverNames.includes(driverName)){
    console.log("Invalid or missing driver parameter!");
    console.log(`Usage: npm start <${driverNames.join('|')}>`);
    process.exit(-1);
  }

  logger.setLevel('debug');
  logger.info("Using driver <%s>", driverName);

  User = require(`./lib/user-${driverName}`);  

  const migrationsDir = Path.join(require.main.path, 'migrations', driverName);
  const driver = User.createDriver();

  // Init the DB & run migrations
  await db.initialize(driver, { logger });
  await db.runMigrations(migrationsDir);
}

async function shutdown() {
  logger.info();
  logger.info("Shutting down...");
  await db.shutdown();
  process.exit(0);
}


async function main() {
  await initialize();

  const app = express();

  app.get ('/users',     User.getUsers);
  app.get ('/users/:id', User.getUser)
  app.post('/users',     [express.json()], User.addUser);

  app.all('*', (req, res) => {
    res.sendStatus(404);
  });

  // final error handler
  app.use(function(err,req,res,next) {
    logger.error(err.stack||err);
    if (process.env['NODE_ENV'] === 'production'){
        res.sendStatus(err.status||500);
    }
    else {
        res.status(err.status||500).send(err.message);
    }
  });


  app.listen(5000);
  logger.info("Server ready.");
}

// graceful shutdown
process.on('SIGINT', shutdown);    // CTRL-C

main().catch(err => console.error(err));
