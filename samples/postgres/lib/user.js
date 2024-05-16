'use strict';
const { db } = require('../../..');
const logger = require('./logger');


exports.getUsers = async (req, res) => {
  const users = await db.query(null, "SELECT u.id, u.name, a.street, a.postcode, a.city FROM \"user\" u, \"address\" a WHERE u.address_id = a.id");
  res.status(200).send(users);
}

exports.getUser = async (req, res) => {
  const {id} = req.params;
  const user = await db.querySingle(null, "SELECT u.name, a.street, a.postcode, a.city FROM \"user\" u, \"address\" a WHERE u.address_id = a.id AND u.id=$1", [id]);
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
      const ares = await conn.querySingle("INSERT INTO \"address\"(street,postcode,city) VALUES($1,$2,$3) RETURNING id", [street,postcode,city]);
      const ures = await conn.querySingle("INSERT INTO \"user\"(name,address_id) VALUES($1,$2) RETURNING id", [name, ares.id]);
      return ures.id;
    });

    logger.debug("Added new user (%s): %s", uid, name);
    res.status(200).send({uid});
  }
  catch(err) {
    if (err.code === '23505'){
      logger.info("Could not add user: a user with that name already exist in the DB!");
      res.status(490).send("Duplicate user name");  // some code to indicate the situation to the client
    }
    else {
      res.sendStatus(500);
    }
  }
}
