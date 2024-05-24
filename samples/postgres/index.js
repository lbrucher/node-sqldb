'use strict';
const express = require('express');
const { db } = require('../../');
const PG = require('use-db-pg');
const User = require('./lib/user');
const logger = require('./lib/logger');


async function initialize() {
  logger.setLevel('trace');

  // We'll be using the Postgres driver
  const dbOptions = {
    host: 'localhost',
    port: 5432,
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
    database: process.env['DB_NAME'],
    poolSize: 10
  };
  const driver = new PG(dbOptions);

  // Init the DB & run migrations automatically
  await db.initialize(driver, { logger, runMigrations:true });
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
    logger.info("XXXXXXXXXXXXXX");
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
