'use strict';
//
// Simple logger, essentially a wrapper around console.log so that log outputs can be disabled during tests
//
const levels = {
    trace: {display:'TRACE', log:null,     num:1},
    debug: {display:'DEBUG', log:null,     num:2},
    info:  {display:'INFO',  log:null,     num:3},
    warn:  {display:'WARN',  log:'/WARN',  num:4},
    error: {display:'ERROR', log:'/ERROR', num:5},
    off:   {display:'',      log:null,     num:99},
};

let current_level = levels['off'].num;
const logger = {};


function date_display(){
    const d = new Date();

    function p0(s, num){
        s = s.toString();
        return "0000000000".substr(0, num-s.length)+s;
    }

    return `${p0(d.getYear()-100,2)}${p0(d.getMonth()+1,2)}${p0(d.getDate(),2)} ${p0(d.getHours(),2)}:${p0(d.getMinutes(),2)}:${p0(d.getSeconds(),2)}`;
}

Object.keys(levels).forEach(function(level){
    const lvl = levels[level];

    logger[level] = function(){
        if (lvl.num < current_level)
            return;

        let args = Array.prototype.slice.call(arguments);
        const prefix = `${date_display()}  ${lvl.log?lvl.log:''} - `;

        if (args.length === 0)
            args = [prefix];
        else
            args[0] = prefix+args[0];
        console.log.apply(null,args);
    }

    logger[`is${level.toUpperCase()[0]}${level.substring(1)}Enabled`] = () => lvl.num >= current_level;
});

logger.setLevel = function(_level){
    const l = levels[_level];
    if (l == null){
        console.error("Unrecognized logger level: ",_level);
    }
    else {
        current_level = l.num;
    }
}

module.exports = logger;
