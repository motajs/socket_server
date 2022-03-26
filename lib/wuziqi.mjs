// @ts-check

/** @type {Module} */
export const wuziqi = function (io, tower_name, log) {
    const tower = io.of('/'+tower_name);

    tower.on('connection', function (socket) {

        var wait = function (socket) {
            if (!tower.adapter.rooms['waiting']) {
                log('Waiting '+socket.id);
                socket.join('waiting');
                return;
            }

            var room = tower.adapter.rooms['waiting'];

            if (room.length > 0) {
                var temp = socket.connected[Object.keys(room.sockets)[0]];

                var rand = ~~(Math.random() * 2147483647) + 100;
                while (tower.adapter.rooms[rand] && tower.adapter.rooms[rand].length > 0) {
                    rand = ~~(Math.random() * 2147483647) + 100;
                }

                socket.join(rand);
                temp.leave('waiting');
                temp.join(rand);

                log('Match '+rand+": "+temp.id+" with "+socket.id);

                temp.emit('start', 1, rand);
                socket.emit('start', 2, rand);
                log(rand+" start!");

                var curr = tower.adapter.rooms[rand];
                
                curr.first = temp.id;
                curr.second = socket.id;
                curr.board = [];
                for (var i=0;i<169;i++) curr.board.push(0);
                curr.pos = [];

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
            if (room && room.length >= 2) {
                // tower.in(socket.id).emit('error', '房间已满');
                log(id+" visitor: "+socket.id);
                socket.join(id);
                tower.in(id).emit('msg', ["目前观战人数："+(room.length-2), 0]);
                socket.emit('start', -1, id, room.board.join(""), room.pos);
                return;
            }
            var first = null;
            if (room && room.length == 1) {
                first = socket.connected[Object.keys(room.sockets)[0]];
            }
            socket.join(id);
            log(id+" player: "+socket.id);
            if (first) {
                room = tower.adapter.rooms[id];
                first.emit('start', 1, id);
                socket.emit('start', 2, id);
                log(id+" start!");
                room.first = first.id;
                room.second = socket.id;
                room.board = [];
                for (var i=0;i<169;i++) room.board.push(0);
                room.pos = [];
            }
        });

        socket.on('ready', function (id) {
            var room = tower.adapter.rooms[id];
            if (!room) {
                tower.in(id).emit('error', '未知错误');
                return;
            }
            room.count = room.count || 0;
            room.count++;
            log(id+" ready: "+socket.id);
            if (room.count == 2) {
                delete room.count;
                tower.in(id).emit('ready');
                room.board = [];
                for (var i=0;i<169;i++) room.board.push(0);
                room.pos = [];
                tower.in(id).emit('board', room.board.join(""), room.pos);
            }
        })

        socket.on('put', function (id, data) {
            log(id+": "+data);
            tower.in(id).emit('put', data);

            var room = tower.adapter.rooms[id];
            if (!room || !room.board || !room.pos) return;
            var x = data[0], y = data[1];
            room.board[13*x+y] = data[2];
            room.pos = [x,y];
            tower.in(id).emit('board', room.board.join(""), room.pos);
        })

        socket.on('msg', function (id, data) {
            log(id+": "+data);
            tower.in(id).emit('msg', data);
        })

        socket.on('disconnecting', function () {
            Object.keys(socket.rooms).forEach(function (id) {
                // tower.in(id).emit('error', '对方断开了链接');
                var room = tower.adapter.rooms[id];
                if (id!=socket.id)
                    log(id+" disconnect: "+socket.id);
                if (room && room.first && room.second) {
                    if (room.first==socket.id || room.second==socket.id) {
                        tower.in(id).emit('error', '对方断开了连接');
                        return;
                    }
                    tower.in(id).emit('msg', ["目前观战人数："+(tower.adapter.rooms[id].length-3), 0]);
                    return;
                }
                tower.in(id).emit('error', '对方断开了连接');
            });
        })
    });
    return tower;
}