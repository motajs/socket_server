const socketIO = require('socket.io');
const fs = require('fs');
const winston = require('winston');
const { key, cert } = require('./config.js');
require('winston-daily-rotate-file');

var server = null;

if (fs.existsSync(key)) {
    server = require('https').createServer({
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert)
    });
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
    const date = new Date();
    const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    return "["+ isoString + "] ";
}

function log(msg) {
    logger.info(msg);
};

function useModule (name) {
    require('./lib/'+name)(io, name, msg => log(name + " " + getTime() + ": " + msg));
}

useModule('wuziqi');
useModule('pencil');
useModule('zhanqi1');
useModule('MTWar');
