'use strict';
const express = require('express');
const { db } = require('../../');
const PG = require('node-sqldb-pg');
const Users = require('./lib/users');
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

  // Init the DB
  await db.initialize(driver, { logger });

  // Run migrations
//  await db.runMigrations();
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

  app.get('/users',     Users.getUsers);
  app.get('/users/:id', Users.getUser)
  app.post('/users',    Users.addUser);

  app.listen(5000);
  logger.info("Ready.");
}

// graceful shutdown
process.on('SIGINT', shutdown);    // CTRL-C

main().catch(err => console.error(err));
