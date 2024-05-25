'use strict';
module.exports = async function(conn) {
  await conn.exec([
    `CREATE TABLE address(
      id INT NOT NULL AUTO_INCREMENT,
      street VARCHAR(255) NOT NULL,
      postcode INT NOT NULL,
      city VARCHAR(64) NOT NULL,
      PRIMARY KEY(id)
    )`,

    `CREATE TABLE user(
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(64) NOT NULL UNIQUE,
      address_id INT REFERENCES address(id) ON DELETE CASCADE,
      PRIMARY KEY(id)
    )`
  ]);
}
