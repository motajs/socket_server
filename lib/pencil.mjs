// @ts-check

/** @type {Module} */
export const pencil = function (io, tower_name, log) {
    const tower = io.of('/'+tower_name);

    tower.on('connection', function (socket) {

        var wait = function (socket, data) { // data [xsize,ysize,playerId]
            if (!tower.adapter.rooms['waiting']) {
                log('Waiting '+socket.id);
                socket.join('waiting');
                tower.adapter.rooms['waiting'].data=data
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

                data=room.data
                temp.emit('start', data, rand);
                var data2=[data[0],data[1],1-data[2]];
                socket.emit('start', data2, rand);
                log(rand+" start!");

                var curr = tower.adapter.rooms[rand];
                
                curr.first = temp.id;
                curr.second = socket.id;
                curr.board = [];

                return;
            }

            socket.join('waiting');
        }

        socket.on('join', function (id, data) { // data [xsize,ysize,playerId]
            if (id == 0) {
                wait(socket, data);
                return;
            }
            var room = tower.adapter.rooms[id];
            if (room && room.length >= 2) {
                //zzzzz bug in h5 tower
                tower.in(socket.id).emit('error', '房间已满');
                return;
                log(id+" visitor: "+socket.id);
                socket.join(id);
                tower.in(id).emit('msg', ["目前观战人数："+(room.length-2), 2]);
                data=room.data
                var data3=[data[0],data[1],-1];
                //zzzzz
                // socket.emit('start', data3, id, room.board);
                return;
            }
            var first = null;
            if (room && room.length == 1) {
                first = socket.connected[Object.keys(room.sockets)[0]];
            }
            socket.join(id);
            if (!room){
                tower.adapter.rooms[id].data=data
            }
            log(id+" player: "+socket.id);
            if (first) {
                room = tower.adapter.rooms[id];
                data=room.data
                first.emit('start', data, id);
                var data2=[data[0],data[1],1-data[2]];
                socket.emit('start', data2, id);
                log(id+" start!");
                room.first = first.id;
                room.second = socket.id;
                room.board = [];
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
                //zzzzz
                // tower.in(id).emit('board', room.board);
            }
        })

        socket.on('put', function (id, data) {
            log(id+": "+data);
            tower.in(id).emit('put', data);

            var room = tower.adapter.rooms[id];
            if (!room || !room.board) return;
            room.board.push(data);
            //zzzzz
            // tower.in(id).emit('board', room.board);
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
                    tower.in(id).emit('msg', ["目前观战人数："+(tower.adapter.rooms[id].length-3), 2]);
                    return;
                }
                tower.in(id).emit('error', '对方断开了连接');
            });
        })
    });
}