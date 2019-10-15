module.exports = function (io, isset, getTime) {
    var log = function (message) {
        console.log('zhanqi1: ' + getTime() + message);
    }

    const tower = io.of('zhanqi1');

    tower.on('connection', function (socket) {
        var wait = function (socket) {
            if (!isset(tower.adapter.rooms['waiting'])) {
                log('Waiting '+socket.id);
                socket.join('waiting');
                return;
            }

            var room = tower.adapter.rooms['waiting'];

            if (room.length > 0) {
                var temp = tower.connected[Object.keys(room.sockets)[0]];

                var rand = parseInt(Math.random() * 2147483647) + 100;
                while (isset(tower.adapter.rooms[rand]) && tower.adapter.rooms[rand].length > 0) {
                    rand = parseInt(Math.random() * 2147483647) + 100;
                }

                socket.join(rand);
                temp.leave('waiting');
                temp.join(rand);

                log('Match '+rand+": "+temp.id+" with "+socket.id);

                temp.emit('start', 0, rand);
                socket.emit('start', 1, rand);
                log(rand+" start!");

                var curr = tower.adapter.rooms[rand];
                
                curr.first = temp.id;
                curr.second = socket.id;
                // curr.board = [];
                // for (var i=0;i<169;i++) curr.board.push(0);
                // curr.pos = [];
                return;
            }

            socket.join('waiting');
        }

        socket.on('join', function (id) {
            if (id == 0) {
                wait(socket);
                return;
            }
            var room = tower.adapter.rooms[id];
            if (isset(room) && room.length >= 2) {
                tower.in(socket.id).emit('error', '房间已满');
                //log(id+" visitor: "+socket.id);
                //socket.join(id);
                //wuziqi.in(id).emit('msg', ["目前观战人数："+(room.length-2), 0]);
                //socket.emit('start', -1, id, room.board.join(""), room.pos);
                return;
            }
            var first = null;
            if (isset(room) && room.length == 1) {
                first = tower.connected[Object.keys(room.sockets)[0]];
            }
            socket.join(id);
            log(id+" player: "+socket.id);
            if (isset(first)) {
                room = tower.adapter.rooms[id];
                first.emit('start', 0, id);
                socket.emit('start', 1, id);
                log(id+" start!");
                room.first = first.id;
                room.second = socket.id;
            }
        });

        socket.on('ready', function (id) {
            var room = tower.adapter.rooms[id];
            if (!isset(room)) {
                tower.in(id).emit('error', '未知错误');
                return;
            }
            if (!isset(room.count)) room.count = 0;
            room.count++;
            log(id+" ready: "+socket.id);
            if (room.count == 2) {
                delete room.count;
                tower.in(id).emit('ready');
            }
        })

        socket.on('put', function (id, data) {
            log(id+": "+data);
            tower.in(id).emit('put', data);
        })

        socket.on('msg', function (id, data) {
            log(id+": "+data);
            tower.in(id).emit('msg', data);
        })

        socket.on('disconnecting', function () {
            Object.keys(socket.rooms).forEach(function (id) {
                tower.in(id).emit('error', '对方断开了链接');
                log(id+" disconnect: "+socket.id);
            });
        })
    })
}