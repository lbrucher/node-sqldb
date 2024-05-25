'use strict';
const { db } = require('../..');
const MySQL = require('use-db-mysql');
const logger = require('./logger');


exports.createDriver = () => {
  const dbOptions = {
    host: 'localhost',
    port: 3306,
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
    database: process.env['DB_NAME'],
    poolSize: 5
  };
  
  return new MySQL(dbOptions);
}

exports.getUsers = async (req, res) => {
  const users = await db.query(null, "SELECT u.id, u.name, a.street, a.postcode, a.city FROM user u, address a WHERE u.address_id = a.id");
  res.status(200).send(users);
}

exports.getUser = async (req, res) => {
  const {id} = req.params;
  const user = await db.querySingle(null, "SELECT u.name, a.street, a.postcode, a.city FROM user u, address a WHERE u.address_id = a.id AND u.id=?", [id]);
  if (user == null){
    res.sendStatus(404);
  }
  else {
    res.status(200).send(user);
  }
}

exports.addUser = async (req, res) => {
  const {name, street, postcode, city} = req.body;

  try {
    const uid = await db.use(db.txIsolationLevels.RR, async (conn) => {
      const ares = await conn.query("INSERT INTO address(street,postcode,city) VALUES(?,?,?)", [street,postcode,city]);
      const ures = await conn.query("INSERT INTO user(name,address_id) VALUES(?,?)", [name, ares.insertId]);
      return ures.insertId;
    });

    logger.debug("Added new user (%s): %s", uid, name);
    res.status(200).send({uid});
  }
  catch(err) {
//console.log(err);
    if (err.code === 'ER_DUP_ENTRY'){
      logger.info("Could not add user: a user with that name already exist in the DB!");
      res.status(490).send("Duplicate user name");  // some code to indicate the situation to the client
    }
    else {
      res.sendStatus(500);
    }
  }
}
