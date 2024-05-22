'use strict';
const should = require('should');
const sinon = require('sinon');
const { db, driverPrototype } = require('../index');

describe('DB', () => {
  let Driver;

  beforeEach(async () => {
    Driver = function() {
      this.shutdown = async () => {};
    };
    Object.assign(Driver.prototype, driverPrototype);
  });

  afterEach(async() => {
    await db.shutdown();
  });

  it("should fail initializing the DB engine with an invalid driver", async () => {
    const driver = { async initialize() {} };
    sinon.stub(driver, 'initialize');

    return db.initialize(driver, {logger:null}).should.be.rejected();
  });

  it("should initialize the DB engine, including the driver", async () => {
    const driver = new Driver();
    sinon.stub(driver, 'initialize');

    await db.initialize(driver, { logger:null });

    driver.initialize.calledOnce.should.be.true();
    Object.keys(driver.initialize.getCall(0).args[0]).should.eql(['logger']);
    should.exist(driver.initialize.getCall(0).args[0].logger);
  });

  it("should expose the driver's transaction isolation levels after initialization", async () => {
    const driver = new Driver();
    sinon.stub(driver, 'initialize');
    driver.txIsolationLevels = {a:1, b:2};

    db.txIsolationLevels.should.eql({});
    await db.initialize(driver, { logger:null });
    db.txIsolationLevels.should.eql({a:1, b:2});
  });
});
