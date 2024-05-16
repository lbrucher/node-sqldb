'use strict';
const should = require('should');
const sinon = require('sinon');
const { db, driverPrototype } = require('../index');

describe('Connection Manager', () => {
  let Driver;
  let driver;
  let client;
  let stubs;

  beforeEach(async () => {
    Driver = function() {
      this.shutdown = async () => {};
    };
    Object.assign(Driver.prototype, driverPrototype);

    client = {client:true};
    driver = new Driver();
    sinon.stub(driver, 'initialize');

    driver.getClient = async () => {};
    driver.releaseClient = async () => {};
    stubs = {
      getClient: sinon.stub(driver, 'getClient').resolves(client),
      releaseClient: sinon.spy(driver, 'releaseClient')
    };

    await db.initialize(driver, {logger:null});
  });

  afterEach(async() => {
    await db.shutdown();
  });


  describe("use", () => {
    it("should return the result of the inner fn(conn)", async () => {
      const rows = await db.use(async (conn) => {
        return [1,2,3];
      });
      rows.should.eql([1,2,3]);
      stubs.getClient.calledOnce.should.be.true();
      stubs.releaseClient.calledOnceWithExactly(client).should.be.true();
    });

    it("should reuse an existing conn (commit)", async () => {
      const conn = {
        conn: true,
        commit: async () => {},
        rollback: async () => {},
      };
      const spies = {
        commit: sinon.spy(conn, 'commit'),
        rollback: sinon.spy(conn, 'rollback')
      };

      const rows = await db.use(conn, async (conn2) => {
        conn2.should.eql(conn);
        return [1,2,3];
      });
      rows.should.eql([1,2,3]);

      // we provided a 'conn' so get/releaseClient() should not be called
      stubs.getClient.notCalled.should.be.true();
      stubs.releaseClient.notCalled.should.be.true();
      spies.commit.notCalled.should.be.true();
      spies.rollback.notCalled.should.be.true();
    });

    it("should reuse an existing conn (rollback)", async () => {
      const conn = {
        conn: true,
        commit: async () => {},
        rollback: async () => {},
      };
      const spies = {
        commit: sinon.spy(conn, 'commit'),
        rollback: sinon.spy(conn, 'rollback')
      };

      try {
        await db.use(conn, async (conn2) => {
          conn2.should.eql(conn);
          throw 'boom';
        });
        should.fail("should not get here!");
      }
      catch(err){
        err.should.equal('boom');
        stubs.getClient.notCalled.should.be.true();
        stubs.releaseClient.notCalled.should.be.true();
        spies.commit.notCalled.should.be.true();
        spies.rollback.notCalled.should.be.true();
      }
    });

    it("should use the db with a transaction", async () => {
      driver.startTransaction = async () => {};
      driver.commitTransaction = async () => {};
      driver.rollbackTransaction = async () => {};

      const spies = {
        startTx: sinon.spy(driver, 'startTransaction'),
        commitTx: sinon.spy(driver, 'commitTransaction'),
        rollbackTx: sinon.spy(driver, 'rollbackTransaction')
      };

      const rows = await db.use('blah', async (conn) => {
        return [1,2,3];
      });
      rows.should.eql([1,2,3]);

      stubs.getClient.calledOnce.should.be.true();
      stubs.releaseClient.calledOnceWithExactly(client).should.be.true();
      spies.startTx.calledOnceWithExactly(client, 'blah').should.be.true();
      spies.commitTx.calledOnceWithExactly(client).should.be.true();
      spies.rollbackTx.notCalled.should.be.true();
    });

    it("should fail without an execution fn", async () => {
      return db.use('tx').should.be.rejected();
    });
  });


  describe("useWithRetry", () => {

    it.skip("should retry querying the db", async () => {
    // TODO
    });

    // more tests...
  });


  describe("Helpers", () => {

    describe("without transactions", () => {
      it("should test db.query()", async () => {
        sinon.stub(driver, 'query').withArgs(client, "SELECT", ['john']).resolves([1,2]);
        const rows = await db.query(null, "SELECT", ['john']);
        rows.should.eql([1,2]);
      });
  
      it("should test db.querySingle()", async () => {
        sinon.stub(driver, 'query').withArgs(client, "SELECT").resolves([198,305]);
        const rows = await db.querySingle(null, "SELECT");
        rows.should.equal(198);
      });

      it("should test db.exec()", async () => {
        sinon.stub(driver, 'exec').withArgs(client, "INSERT", ['john']).resolves(3);
        const n = await db.exec(null, "INSERT", ['john']);
        n.should.equal(3);
      });

      it.skip("should test db.retryableQuery()", async () => {
        // sinon.stub(driver, 'query').withArgs(client, "SELECT", ['john']).resolves([1,2]);
        // const rows = await db.retryableQuery(null, "SELECT", ['john']);
        // rows.should.eql([1,2]);
      });

      it.skip("should test db.retryableExec()", async () => {
        // sinon.stub(driver, 'exec').withArgs(client, "INSERT", ['john']).resolves(3);
        // const n = await db.exec(null, "INSERT", ['john']);
        // n.should.equal(3);
      });
    });

    describe("with transactions", () => {
      let spies;

      beforeEach(async () => {
        driver.startTransaction = async () => {};
        driver.commitTransaction = async () => {};
        driver.rollbackTransaction = async () => {};
  
        spies = {
          startTx: sinon.spy(driver, 'startTransaction'),
          commitTx: sinon.spy(driver, 'commitTransaction'),
          rollbackTx: sinon.spy(driver, 'rollbackTransaction')
        };
      });

      it("should test db.query()", async () => {
        sinon.stub(driver, 'query').withArgs(client, "SELECT", ['john']).resolves([1,2]);
        const rows = await db.query('rr', "SELECT", ['john'])
        rows.should.eql([1,2]);
        spies.startTx.calledOnceWithExactly(client, 'rr').should.be.true();
        spies.commitTx.calledOnceWithExactly(client).should.be.true();
        spies.rollbackTx.notCalled.should.be.true();
      });
  
      it("should test db.exec() with rollback", async () => {
        sinon.stub(driver, 'exec').withArgs(client, "INSERT").throws('boom');
        try {
          await db.exec('rr', "INSERT");
          should.fail("should not get here!");
        }
        catch(err) {
          err.name.should.equal('boom');
          spies.startTx.calledOnceWithExactly(client, 'rr').should.be.true();
          spies.commitTx.notCalled.should.be.true();
          spies.rollbackTx.calledOnceWithExactly(client, err).should.be.true();
        }
      });


      it.skip("should test db.retryableQuery()", async () => {
        // TODO
      });

      it.skip("should test db.retryableExec()", async () => {
        // TODO
      });
    });
  });
});
