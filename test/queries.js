'use strict';
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const should = require('should');


describe('Queries', () => {
  let db;

  beforeEach(async () => {
    db = await sqlite.open({
      filename: ":memory:",
      driver: sqlite3.Database
    })

    await db.exec('CREATE TABLE users (firstname TEXT, lastname TEXT, zip INT, city TEXT)');
    await db.exec('INSERT INTO users VALUES ("john", "doe", 1390, "Grez-Doiceau")');
    await db.exec('INSERT INTO users VALUES ("mary", "wart", 1300, "Jodoigne")');
    await db.exec('INSERT INTO users VALUES ("grace", "muno", 1390, "Nethen")');
  });

  it("should query for data", async () => {
    const result = await db.all('SELECT * FROM users WHERE zip = ?', 1390);
console.log("RESULTS: ", result);
  });
});
