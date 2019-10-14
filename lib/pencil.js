module.exports = function (io, isset, getTime) {
    const pencil = io.of('/pencil');
    pencil.on('connection', function (socket) {

        var wait = function (socket, data) { // data [xsize,ysize,playerId]
            if (!isset(pencil.adapter.rooms['waiting'])) {
                console.log(getTime()+'Waiting '+socket.id);
                socket.join('waiting');
                pencil.adapter.rooms['waiting'].data=data
                return;
            }

            var room = pencil.adapter.rooms['waiting'];

            if (room.length > 0) {
                var temp = pencil.connected[Object.keys(room.sockets)[0]];

                var rand = parseInt(Math.random() * 2147483647) + 100;
                while (isset(pencil.adapter.rooms[rand]) && pencil.adapter.rooms[rand].length > 0) {
                    rand = parseInt(Math.random() * 2147483647) + 100;
                }

                socket.join(rand);
                temp.leave('waiting');
                temp.join(rand);

                console.log(getTime()+'Match '+rand+": "+temp.id+" with "+socket.id);

                data=room.data
                temp.emit('start', data, rand);
                var data2=[data[0],data[1],1-data[2]];
                socket.emit('start', data2, rand);
                console.log(getTime()+rand+" start!");

                var curr = pencil.adapter.rooms[rand];
                
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
            var room = pencil.adapter.rooms[id];
            if (isset(room) && room.length >= 2) {
                //zzzzz bug in h5 pencil
                pencil.in(socket.id).emit('error', '房间已满');
                return;
                console.log(getTime()+id+" visitor: "+socket.id);
                socket.join(id);
                pencil.in(id).emit('msg', ["目前观战人数："+(room.length-2), 2]);
                data=room.data
                var data3=[data[0],data[1],-1];
                //zzzzz
                // socket.emit('start', data3, id, room.board);
                return;
            }
            var first = null;
            if (isset(room) && room.length == 1) {
                first = pencil.connected[Object.keys(room.sockets)[0]];
            }
            socket.join(id);
            if (!isset(room)){
                pencil.adapter.rooms[id].data=data
            }
            console.log(getTime()+id+" player: "+socket.id);
            if (isset(first)) {
                room = pencil.adapter.rooms[id];
                data=room.data
                first.emit('start', data, id);
                var data2=[data[0],data[1],1-data[2]];
                socket.emit('start', data2, id);
                console.log(getTime()+id+" start!");
                room.first = first.id;
                room.second = socket.id;
                room.board = [];
            }
        });

        socket.on('ready', function (id) {
            var room = pencil.adapter.rooms[id];
            if (!isset(room)) {
                pencil.in(id).emit('error', '未知错误');
                return;
            }
            if (!isset(room.count)) room.count = 0;
            room.count++;
            console.log(getTime()+id+" ready: "+socket.id);
            if (room.count == 2) {
                delete room.count;
                pencil.in(id).emit('ready');
                room.board = [];
                //zzzzz
                // pencil.in(id).emit('board', room.board);
            }
        })

        socket.on('put', function (id, data) {
            console.log(getTime()+id+": "+data);
            pencil.in(id).emit('put', data);

            var room = pencil.adapter.rooms[id];
            if (!isset(room) || !isset(room.board)) return;
            room.board.push(data);
            //zzzzz
            // pencil.in(id).emit('board', room.board);
        })

        socket.on('msg', function (id, data) {
            console.log(getTime()+id+": "+data);
            pencil.in(id).emit('msg', data);
        })

        socket.on('disconnecting', function () {
            Object.keys(socket.rooms).forEach(function (id) {
                // pencil.in(id).emit('error', '对方断开了链接');
                var room = pencil.adapter.rooms[id];
                if (id!=socket.id)
                    console.log(getTime()+id+" disconnect: "+socket.id);
                if (isset(room) && isset(room.first) && isset(room.second)) {
                    if (room.first==socket.id || room.second==socket.id) {
                        pencil.in(id).emit('error', '对方断开了连接');
                        return;
                    }
                    pencil.in(id).emit('msg', ["目前观战人数："+(pencil.adapter.rooms[id].length-3), 2]);
                    return;
                }
                pencil.in(id).emit('error', '对方断开了连接');
            });
        })
    });
}