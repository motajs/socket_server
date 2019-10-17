var request = require('request');

module.exports = function (io, tower_name, log) {
    const tower = io.of('/'+tower_name);

    function setTwoDigits(x) { return x<10 ? "0"+x : x;}

    function formatTime(gametime) {
        gametime /= 1000;
        return setTwoDigits(parseInt(gametime / 60)) + ":" + setTwoDigits(parseInt(gametime % 60));
    }

    function sendResult(winner, loser, tie, id, gametime) {
        log(id + " competition result: " + winner.uid + " vs " + loser.uid + " " + (tie ? "tie" : "win") + "! time=" + formatTime(gametime));
        var data = {
            name: tower_name,
            winner_uid: winner.uid,
            winner_pass: winner.password,
            loser_uid: loser.uid,
            loser_pass: loser.password,
            tie: tie,
            gametime: gametime
        }
        request.post({
            url: "https://h5mota.com/rank/upload.php",
            form: data
        }, function (error, response, body) {          
            if (error) return log(id + ' uploading error: ' + error);
            if (response && response.statusCode == 200) {
                try {
                    log(id + ' uploading status: ' + JSON.parse(body).msg);
                } catch (e) {
                    log(id + " uploading error " + e);
                }
            }
        });
    }

    tower.on('connection', function (socket) {
        var wait = function (socket, mode) {
            var name = mode == 2 ? 'competition' : 'waiting'

            if (!tower.adapter.rooms[name]) {
                log(name + ' '+socket.id);
                socket.join(name);
                return;
            }

            var room = tower.adapter.rooms[name];

            if (room.length > 0) {
                var temp = tower.connected[Object.keys(room.sockets)[0]];

                var rand = parseInt(Math.random() * 2147483647) + 100;
                while (tower.adapter.rooms[rand] && tower.adapter.rooms[rand].length > 0) {
                    rand = parseInt(Math.random() * 2147483647) + 100;
                }

                socket.join(rand);
                temp.leave(name);
                temp.join(rand);

                log(name + ' Match '+rand+": "+temp.id+" with "+socket.id);

                temp.emit('start', 0, rand);
                socket.emit('start', 1, rand);
                log(rand+" start!");

                var curr = tower.adapter.rooms[rand];
                curr.first = temp.id;
                curr.second = socket.id;
                if (mode == 2) curr.competition = true;
                return;
            }

            socket.join(name);
        };

        socket.on('join', function (id, mode) {
            if (id == 0) {
                wait(socket, mode);
                return;
            }
            var room = tower.adapter.rooms[id];
            if (room && room.length >= 2) {
                tower.in(socket.id).emit('error', '房间已满');
                return;
            }
            var first = null;
            if (room && room.length == 1) {
                first = tower.connected[Object.keys(room.sockets)[0]];
            }
            socket.join(id);
            log(id+" player: "+socket.id);
            if (first) {
                room = tower.adapter.rooms[id];
                first.emit('start', 0, id);
                socket.emit('start', 1, id);
                log(id+" start!");
                room.first = first.id;
                room.second = socket.id;
            }
        });

        socket.on('ready', function (id, uid, password, version) {
            var room = tower.adapter.rooms[id];
            if (!room) {
                tower.in(id).emit('error', '未知错误');
                return;
            }
            if (room.competition && !(uid && password)) {
                tower.in(id).emit('error', '无效的对局：未知用户');
                return;
            }

            room.count = room.count || 0;
            room.players = room.players || {};
            room.count++;
            if (room.version && room.version != version) {
                log(id + " version mismatch: " + room.version + " vs " + version);
                tower.in('id').emit('error', '双方版本不一致。\n请强制刷新浏览器后重试。');
                return;
            } 
            // 已经准备过
            if (room.players[socket.id]) return;

            room.version = version;
            log(id+" ready: "+socket.id + (uid ? " " + uid : ""));
            room.players[socket.id] = {uid: uid, password: password};
            if (room.count == 2) {
                delete room.count;
                if (room.competition) {
                    var uids = [];
                    for (var x in room.players) uids.push(room.players[x].uid);
                    if (uids[0] == uids[1]) {
                        tower.in(id).emit('error', '对局双方id相同');
                        return;
                    }
                    tower.in(id).emit('players', uids);
                }
                tower.in(id).emit('ready');
                room.hasPut = false;
                room.started = true;
                room.startTime = new Date();
            }
        });

        var _getRoom = function (socketId) {
            for (var name in tower.adapter.rooms) {
                var room = tower.adapter.rooms[name];
                if (room.first == socketId || room.second == socketId)
                    return name;
            }
            return null;
        }

        socket.on('disconnecting', function () {
            log("disconnecting: "+socket.id);
            var id = _getRoom(socket.id);
            if (id == null) return;
            tower.in(id).emit('error', '对方断开了链接');
            log(id+" disconnect: "+socket.id);

            var room = tower.adapter.rooms[id];
            if (room == null) return;
            if (room.competition && room.started && room.hasPut && room.players && room.players[socket.id]) {
                var winner = null, loser = null;
                for (var player in room.players) {
                    if (player == socket.id) loser = room.players[player];
                    else winner = room.players[player];
                }
                sendResult(winner, loser, 0, id, new Date() - room.startTime);
            }
            room.started = false;
        });

        socket.on('result', function (id, result) {
            var room = tower.adapter.rooms[id];
            if (!room || !room.competition || !room.started) return;

            var _check = function () {
                if (room.winner && room.loser) {
                    sendResult(room.winner, room.loser, 0, id, new Date() - room.startTime);
                    room.started = false;
                }
            }

            var player = room.players[socket.id];
            if (result == 0) {
                if (!room.loser) room.loser = player;
                return _check();
            }
            if (result == 1) {
                if (!room.winner) room.winner = player;
                return _check();
            }
            if (result == 2) {
                if (room.tie == null) room.tie = player;
                else {
                    sendResult(room.tie, player, 1, 1, new Date() - room.startTime);
                    room.started = false;
                }
                return;
            }
        });

        socket.on('put', function (id, data) {
            log(id + " [put]: " + data);
            tower.in(id).emit('put', data);
            var room = tower.adapter.rooms[id];
            if (!room) return;
            room.hasPut = true;
        });

        ["msg", "asktie", "asktie_res", "asklose"].forEach(function (e) {
            socket.on(e, function (id, data) {
                log(id + " [" +e+ "]: " + data);
                tower.in(id).emit(e, data);
            })
        })
    });

    return tower;
}