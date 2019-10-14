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
    console.log(getTime()+'Starting server on port 5050');
});

var isset = function (t) {
    if (t == undefined || t == null || (typeof t == "number" && isNaN(t)))
        return false;
    return true;
}

var getTime = function() {
    var date = new Date();
    var setTwoDigits = function(x) {return parseInt(x)<10?("0"+x):x;}
    return "[" + 
        date.getFullYear()+"-"+setTwoDigits(date.getMonth()+1)+"-"+setTwoDigits(date.getDate())+" "
        +setTwoDigits(date.getHours())+":"+setTwoDigits(date.getMinutes())+":"+setTwoDigits(date.getSeconds())+
    "] ";
}

require('./lib/wuziqi')(io, isset, getTime);
require('./lib/pencil')(io, isset, getTime);
