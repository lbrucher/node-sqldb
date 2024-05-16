'use strict';
const noop = function() {};
const log = function(level) {
  return function() {
    let args = Array.prototype.slice.call(arguments);
    const prefix = `[${level}] `;

    if (args.length === 0)
        args = [prefix];
    else
        args[0] = prefix+args[0];
    console.log.apply(null,args);
  };
}

const logger = {
  trace: noop,
  debug: noop,
  info:  log("INFO"),
  warn:  log("WARN"),
  error: log("ERROR")
};

module.exports = logger;
