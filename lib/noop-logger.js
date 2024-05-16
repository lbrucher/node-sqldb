'use strict';
const noop = function() {};

const logger = {
  trace: noop,
  debug: noop,
  info:  noop,
  warn:  noop,
  error: noop
};

module.exports = logger;
