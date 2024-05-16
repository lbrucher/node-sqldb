'use strict';

function extractAllFunctionNames(obj) {
  const names = [];
  while(obj != null && Object.getPrototypeOf(obj) != null){
    // use Object.keys() instead of Object.getOwnPropertyNames() becasue we don't want non-enumerable props. 
    const props = Object.keys(obj);
    names.push(...props.filter(p => (typeof obj[p] === 'function' && !names.includes(p))));

    obj = Object.getPrototypeOf(obj);
  }
  return names;
}

// Utility function that will verify that the given obj implements all methods defined in the given prototype
// Returns [] if all of the prototype functions are found in the given obj.
// return the missing function names otherwise.
function _getMissingPrototypeFunctions(obj, prototype) {
  const protoNames = extractAllFunctionNames(prototype);
  const objNames = extractAllFunctionNames(obj);

  const missingNames = protoNames.filter(name => !objNames.includes(name));
  return missingNames;
}


module.exports = function(methods) {
  const proto = {};

  // Helper for implementations to verify it complies with the interface definition
  Object.defineProperty(proto, "_getMissingPrototypeFunctions", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: _getMissingPrototypeFunctions,
  });

  for(const method of methods) {
    proto[method] = function() {
      throw new Error(`The function '${method}' must be implemented in child objects!`);
    }
  }
  return proto;
}