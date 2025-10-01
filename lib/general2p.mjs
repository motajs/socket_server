// @ts-check

/** @type {Module} */
export const general2p = function (io, tower_name, log) {

    const isset=v=>v;
    const towers = io.of(/^\/general2p\/.+$/);
    towers.on('connection', function (socket) {
        const tower = socket.nsp;
        const printlog=(msg)=>log(tower.name.slice(11),msg);
        var wait = function (socket, board) { // board [playerId, ...]
            if (!isset(tower.adapter.rooms['waiting'])) {
                printlog('Waiting '+JSON.stringify(board)+' '+socket.id);
                socket.join('waiting');
                tower.adapter.rooms['waiting'].board=board
                return;
            }
    
            var room = tower.adapter.rooms['waiting'];
    
            if (room.length > 0) {
                var temp = tower.connected[Object.keys(room.sockets)[0]];
    
                var id = ~~(Math.random() * 2147483647) + 100;
                while (isset(tower.adapter.rooms[id]) && tower.adapter.rooms[id].length > 0) {
                    id = ~~(Math.random() * 2147483647) + 100;
                }
    
                socket.join(id);
                temp.leave('waiting');
                temp.join(id);
    
                printlog('Match '+id+": "+temp.id+" with "+socket.id);
    
                board=room.board
                temp.emit('start', id, board);
                var board2=[1-board[0],...board.slice(1)];
                socket.emit('start', id, board2);
                printlog(id+" start!");
    
                var curr = tower.adapter.rooms[id];
                
                curr.first = temp.id;
                curr.second = socket.id;
                curr.position = [];
                curr.board = board;
    
                return;
            }
    
            socket.join('waiting');
        }
    
        socket.on('join', function (id, board) { // board [playerId, ...]
            if (id == 0) {
                wait(socket, board);
                return;
            }
            var room = tower.adapter.rooms[id];
            if (isset(room) && room.length >= 2) {
                // tower.in(socket.id).emit('error', '房间已满');
                printlog(id+" visitor: "+socket.id);
                socket.join(id);
                tower.in(id).emit('msg', [2,0,"目前观战人数："+(room.length-2)]);
                board=room.board
                var board3=[-1,...board.slice(1)];
                socket.emit('start', id, board3);
                socket.emit('position', room.position);
                return;
            }
            var first = null;
            if (isset(room) && room.length == 1) {
                first = tower.connected[Object.keys(room.sockets)[0]];
            }
            socket.join(id);
            if (!isset(room)){
                tower.adapter.rooms[id].board=board
            }
            printlog(id+" player: "+socket.id);
            if (isset(first)) {
                room = tower.adapter.rooms[id];
                board=room.board
                first.emit('start', id, board);
                var board2=[1-board[0],...board.slice(1)];
                socket.emit('start', id, board2);
                printlog(id+" start!");
                room.first = first.id;
                room.second = socket.id;
                room.position = [];
            }
        });
    
        socket.on('ready', function (id, condition) { 
            var room = tower.adapter.rooms[id];
            if (!isset(room)) {
                tower.in(id).emit('error', '未知错误');
                return;
            }
            if (!isset(room.count)) room.count = 0;
            room.count++;
            printlog(id+" ready: "+JSON.stringify(condition)+' '+socket.id);
            if (room.first==socket.id)room.condition=condition;
            if (room.count == 2) {
                delete room.count;
                room.position = [room.condition];
                tower.in(id).emit('ready', room.condition);
                tower.in(id).emit('position', room.position);
            }
        })
    
        socket.on('put', function (id, square) {
            printlog(id+": "+square);
            tower.in(id).emit('put', square);
    
            var room = tower.adapter.rooms[id];
            if (!isset(room) || !isset(room.position)) return;
            room.position.push(square);
            tower.in(id).emit('position', room.position);
        })
    
        socket.on('msg', function (id, data) {
            printlog(id+": "+data);
            tower.in(id).emit('msg', data);
        })
    
        socket.on('disconnecting', function () {
            Object.keys(socket.rooms).forEach(function (id) {
                // tower.in(id).emit('error', '对方断开了链接');
                var room = tower.adapter.rooms[id];
                if (id!=socket.id)
                    printlog(id+" disconnect: "+socket.id);
                if (isset(room) && isset(room.first) && isset(room.second)) {
                    if (room.first==socket.id || room.second==socket.id) {
                        tower.in(id).emit('error', '对方断开了连接');
                        return;
                    }
                    tower.in(id).emit('msg', [2,0,"目前观战人数："+(tower.adapter.rooms[id].length-3)]);
                    return;
                }
                tower.in(id).emit('error', '对方断开了连接');
            });
        })
    });

}