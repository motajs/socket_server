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

server.listen(5050, function() {
  console.log('Starting server on port 5050');
});

var isset = function(t) {
  if (t==undefined || t==null || (typeof t == "number" && isNaN(t)))
    return false;
  return true;
}

const wuziqi = io.of('/wuziqi');
wuziqi.on('connection', function(socket) {

  socket.on('join', function(id) {
    if (id==0) {
      wuziqi.in(socket.id).emit('error', '房间号不合法');
      return;
    }
    var room = wuziqi.adapter.rooms[id];
    // console.log(room);
    if (isset(room) && room.length==2) {
      wuziqi.in(socket.id).emit('error', '房间已满');
      return;
    }
    var first = null;
    if (isset(room) && room.length==1) {
      first = wuziqi.connected[Object.keys(room.sockets)[0]];
    }
    socket.join(id);
    if (isset(first)) {
      first.emit('start', 1);
      socket.emit('start', 2);
    }
    // console.log(wuziqi.adapter.rooms[id].sockets);
  });

  socket.on('ready', function(id) {
    var room = wuziqi.adapter.rooms[id];
    if (!isset(room)) {
      wuziqi.in(id).emit('error', '未知错误');
      return;
    }
    if (!isset(room.count)) room.count=0;
    room.count++;
    // console.log(room);
    if (room.count==2) {
      delete room.count;
      wuziqi.in(id).emit('ready');
    }
  })

  socket.on('put', function (id, data) {
    //console.log(data);
    wuziqi.in(id).emit('put', data);
  })

  socket.on('disconnecting', function() {
    Object.keys(socket.rooms).forEach(function(id) {
      wuziqi.in(id).emit('error', '对方断开了链接');
    });
  })

/*
  socket.on('disconnect', function(room) {
    rooms[room].forEach(function (socket) {
      socket.close();
    })
  })

  socket.on('new player', function(data) {
    console.log(socket.id);
    var hard = parseInt(data[0])
    if (waitingPlayers[3-hard].length==0){
      waitingPlayers[hard].push(data[0])
      console.log(waitingPlayers)
    } else {
      var opponentId = waitingPlayers[3-hard].shift();
      io.sockets.emit(data[0]+'_opponentId', [opponentId]);
      io.sockets.emit(opponentId+'_opponentId', [data[0]]);
      console.log(waitingPlayers)
    }
    console.log(data)
  });
  socket.on('put', function(data) {
    io.sockets.emit(data[2], [data[0],data[1]]);
    console.log(data)
  });
  */
});


