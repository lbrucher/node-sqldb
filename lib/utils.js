'use strict';

exports.wait = function(msec) {
	return new Promise((resolve) => {
		setTimeout(resolve, msec);
	});
}
