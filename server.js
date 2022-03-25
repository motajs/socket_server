const socketIO = require('socket.io');
const fs = require('fs');
const winston = require('winston');
require('winston-daily-rotate-file');

var server = null;

const key = "/etc/letsencrypt/live/h5mota.com/privkey.pem";
const cert = "/etc/letsencrypt/live/h5mota.com/cert.pem";

if (fs.existsSync(key)) {
    var options = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert)
    }
    server = require('https').createServer(options);
}
else {
    server = require('http').createServer();
}

const io = socketIO(server);

server.listen(5050, function () {
    log(getTime()+'Starting server on port 5050');
});

const transport = new (winston.transports.DailyRotateFile)({
    filename: '%DATE%.log',
    dirname: 'logs/'
});

const logger = winston.createLogger({
    format: winston.format.simple(),
    transports: [transport]
});

function getTime() {
    var date = new Date();
    var isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    return "["+ isoString + "] ";
}

function log(msg) {
    logger.info(msg);
};

var _module = function (name) {
    require('./lib/'+name)(io, name, msg => log(name + " " + getTime() + ": " + msg));
}

_module('wuziqi');
_module('pencil');
_module('zhanqi1');
_module('MTWar');
