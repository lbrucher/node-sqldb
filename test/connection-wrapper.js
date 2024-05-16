'use strict';
const should = require('should');
const sinon = require('sinon');
const { db, driverPrototype } = require('../index');

describe('Connection Wrapper', () => {
  let Driver;
  let driver;
  let client;

  beforeEach(async () => {
    Driver = function() {
      this.shutdown = async () => {};
    };
    Object.assign(Driver.prototype, driverPrototype);

    client = {client:true};
    driver = new Driver();
    sinon.stub(driver, 'initialize');
    // impl of get/releaseClient is unimportant
    driver.getClient = async () => client;
    driver.releaseClient = async (c) => ({});

    await db.initialize(driver, {logger:null});
  });

  afterEach(async() => {
    await db.shutdown();
  });


  it("should test conn.query()", async () => {
    sinon.stub(driver, 'query').withArgs(client, "SELECT * FROM test WHERE name=$1", ['john']).resolves([1,2]);
    const rows = await db.use(async (conn) => {
      return conn.query("SELECT * FROM test WHERE name=$1", ['john']);
    });
    rows.should.eql([1,2]);
  });

  it("should test conn.querySingle() returning data", async () => {
    sinon.stub(driver, 'query').withArgs(client, "SELECT").resolves(['john','mary','lucy']);
    const data = await db.use(async (conn) => {
      return conn.querySingle("SELECT");
    });
    data.should.equal('john');
  });

  it("should test conn.querySingle() returning no data", async () => {
    sinon.stub(driver, 'query').withArgs(client, "SELECT").resolves([]);
    const data = await db.use(async (conn) => {
      return conn.querySingle("SELECT");
    });
    (data === null).should.be.true();
  });


  it("should test conn.exec() with a single query", async () => {
    sinon.stub(driver, 'exec').withArgs(client, "INSERT", ['john']).resolves(1);
    const data = await db.use(async (conn) => {
      return conn.exec("INSERT", ['john']);
    });
    data.should.equal(1);
  });

  it("should test conn.exec() with multiple queries", async () => {
    sinon.stub(driver, 'exec')
      .withArgs(client, "INSERT1").resolves(1)
      .withArgs(client, "INSERT2").resolves(2);

      const data = await db.use(async (conn) => {
        // ['john'] arg will not be used
        return conn.exec(["INSERT1", "INSERT2"], ['john']);
    });
    data.should.eql([1,2]);
  });


  describe("Transactions", () => {
    let spies;

    beforeEach(async () => {
      driver.startTransaction = async () => {};
      driver.commitTransaction = async () => {};
      driver.rollbackTransaction = async () => {};
      client.query = async () => {};

      spies = {
        driver: {
          startTx: sinon.spy(driver, 'startTransaction'),
          commitTx: sinon.spy(driver, 'commitTransaction'),
          rollbackTx: sinon.spy(driver, 'rollbackTransaction'),
        },
        client: {
          query: sinon.spy(client, 'query')
        }
      };
    });

    afterEach(async () => {
      spies.driver.startTx.calledOnceWithExactly(client, 'tx').should.be.true();
    });

    it("should issue an explicit commit", async () => {
      sinon.stub(driver, 'exec').throws("boom!");

      await db.use('tx', async (conn) => {
        conn.exec("INSERT");
        conn.commit();
      });

      spies.client.query.notCalled.should.be.true();
      spies.driver.commitTx.calledOnceWithExactly(client).should.be.true();
      spies.driver.rollbackTx.notCalled.should.be.true();
    });

    it("should commit the tx when successful (driver does not expose the commitTransaction() function)", async () => {
      sinon.stub(driver, 'exec').withArgs(client, "INSERT").resolves(1);
      driver.commitTransaction = undefined;

      const data = await db.use('tx', async (conn) => {
        return conn.exec("INSERT");
      });
      data.should.equal(1);

      spies.client.query.calledOnceWithExactly('COMMIT').should.be.true();
      spies.driver.commitTx.notCalled.should.be.true();
      spies.driver.rollbackTx.notCalled.should.be.true();
    });

    it("should commit the tx when successful (driver does expose the commitTransaction() function)", async () => {
      sinon.stub(driver, 'exec').withArgs(client, "INSERT").resolves(1);

      const data = await db.use('tx', async (conn) => {
        return conn.exec("INSERT");
      });
      data.should.equal(1);

      spies.client.query.notCalled.should.be.true();
      spies.driver.commitTx.calledOnceWithExactly(client).should.be.true();
      spies.driver.rollbackTx.notCalled.should.be.true();
    });

    it("should issue an explicit rollback", async () => {
      sinon.stub(driver, 'exec').throws("boom!");

      await db.use('tx', async (conn) => {
        conn.exec("INSERT");
        // some condition leads us to rolling back the tx
        conn.rollback('boom!');
      });

      spies.client.query.notCalled.should.be.true();
      spies.driver.commitTx.notCalled.should.be.true();
      spies.driver.rollbackTx.calledOnceWithExactly(client, 'boom!').should.be.true();
    });

    it("should rollback the tx when unsuccessful (driver does not expose the rollbackTransaction() function)", async () => {
      sinon.stub(driver, 'exec').throws("boom!");
      driver.rollbackTransaction = undefined;

      try {
        await db.use('tx', async (conn) => {
          return conn.exec("INSERT");
        });
        should.fail('Should not get here!');
      }
      catch(err){
        err.name.should.equal('boom!');

        spies.client.query.calledOnceWithExactly('ROLLBACK').should.be.true();
        spies.driver.commitTx.notCalled.should.be.true();
        spies.driver.rollbackTx.notCalled.should.be.true();
      }
    });

    it("should rollback the tx when unsuccessful (driver does not expose the rollbackTransaction() function)", async () => {
      sinon.stub(driver, 'exec').throws("boom!");
      try {
        await db.use('tx', async (conn) => {
          return conn.exec("INSERT");
        });
        should.fail('Should not get here!');
      }
      catch(err){
        err.name.should.equal('boom!');

        spies.client.query.notCalled.should.be.true();
        spies.driver.commitTx.notCalled.should.be.true();
        spies.driver.rollbackTx.calledOnceWithExactly(client, err).should.be.true();
      }
    });

    it("should handle execptions thrown during startTransaction()", async () => {
      driver.startTransaction = async () => { throw 'start boom'; };
      spies.driver.startTx = sinon.spy(driver, 'startTransaction');

      sinon.stub(driver, 'exec').withArgs(client, "INSERT").resolves(1);

      try {
        await db.use('tx', async (conn) => {
          return conn.exec("INSERT");
        });
        should.fail('should not get here!');
      }
      catch(err){
        err.should.equal('start boom');

        spies.client.query.notCalled.should.be.true();
        spies.driver.commitTx.notCalled.should.be.true();
        // ensure rollback is not called since we did not get a chance to build a connection wrapper!
        spies.driver.rollbackTx.notCalled.should.be.true();
      }
    });

    it("should handle execptions thrown during commit", async () => {
      spies.driver.commitTx.restore();
      spies.driver.commitTx = sinon.stub(driver, 'commitTransaction').throws('commit boom');
      sinon.stub(driver, 'exec').withArgs(client, "INSERT").resolves(1);

      try {
        await db.use('tx', async (conn) => {
          return conn.exec("INSERT");
        });
        should.fail('should not get here!');
      }
      catch(err){
        err.name.should.equal('commit boom');

        spies.client.query.notCalled.should.be.true();
        spies.driver.commitTx.calledOnceWithExactly(client).should.be.true();
        spies.driver.rollbackTx.calledOnceWithExactly(client, err).should.be.true();
      }
    });

    it("should handle execptions thrown during rollback", async () => {
      spies.driver.rollbackTx.restore();
      spies.driver.rollbackTx = sinon.stub(driver, 'rollbackTransaction').throws('rollback boom');
      sinon.stub(driver, 'exec').withArgs(client, "INSERT").resolves(1);

      try {
        await db.use('tx', async (conn) => {
          throw 'woops';
        });
        should.fail('should not get here!');
      }
      catch(err){
        // we're not getting the 'rollback boom' error (swallowed) but the first exception 'woops' instead
        err.should.equal('woops');

        spies.client.query.notCalled.should.be.true();
        spies.driver.commitTx.notCalled.should.be.true();
        spies.driver.rollbackTx.calledOnceWithExactly(client, 'woops').should.be.true();
      }
    });
  });
});
