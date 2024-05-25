'use strict';
module.exports = async function(conn) {
  await conn.exec([
    `CREATE TABLE "address"(
      id SERIAL PRIMARY KEY,
      street TEXT NOT NULL,
      postcode INTEGER NOT NULL,
      city TEXT NOT NULL
    )`,

    `CREATE TABLE "user"(
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        address_id INTEGER REFERENCES address(id) ON DELETE CASCADE
    )`
  ]);
}
