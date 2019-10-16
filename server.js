var socketIO = require('socket.io');
var fs = require('fs');

var server = null;

if (fs.existsSync('/etc/letsencrypt/live/h5mota.com/privkey.pem')) {
    var options = {
        key: fs.readFileSync('/etc/letsencrypt/live/h5mota.com/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/h5mota.com/fullchain.pem')
    }
    server = require('https').createServer(options);
}
else {
    server = require('http').createServer();
}

var io = socketIO(server);

server.listen(5050, function () {
    log(getTime()+'Starting server on port 5050');
});

function getTime() {
    var date = new Date();
    var isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    return "["+ isoString + "] ";
}

function log(msg) {
    console.log(msg);
};

var _module = function (name) {
    require('./lib/'+name)(io, name, msg => log(name + " " + getTime() + ": " + msg));
}

_module('wuziqi');
_module('pencil');
_module('zhanqi1');
