'use strict';
module.exports = async function(conn) {
  await conn.exec([
    `CREATE TABLE addresses(
      id SERIAL PRIMARY KEY,
      street TEXT NOT NULL,
      postcode INTEGER NOT NULL,
      city TEXT NOT NULL
    )`,

    `CREATE TABLE users(
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        address_id INTEGER REFERENCES addresses(id) ON DELETE CASCADE
    )`
  ]);
}
