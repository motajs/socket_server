// @ts-check
import axios from 'axios';
import { formatTime } from '../utils.mjs';

import fs from 'fs';

/** @type {Module} */
export const zhanqi1 = function (io, tower_name, log) {
    const tower = io.of('/'+tower_name);

    function _update_rooms() {
        const filename = "rooms/"+tower_name+".txt";
        var _get_number = function (x) {
            var room = tower.adapter.rooms[x];
            if (!room) return 0;
            return Object.keys(room.sockets).length;
        }

        var contents = "competition\t"+_get_number('competition')+"\nwaiting\t"+_get_number('waiting')+"\n";
        for (var name in tower.adapter.rooms) {
            var room = tower.adapter.rooms[name];
            if (room.competition && room.started) {
                var players = room.players, first = room.first, second = room.second;
                contents += name + "\t" + players[first].uid + "\t" + players[second].uid + "\t" + room.startTime.getTime() + "\t"
                + _get_number("w_" + name) + "\n";
            }
        }
        fs.writeFileSync(filename, contents);
    }

    function write_record(id, content) {
        fs.appendFileSync('records/'+id+".h5record", content+"\n");
        tower.in("w_"+id).emit('watch', content);
    }

    function sendResult(winner, loser, tie, id, gametime) {
        log(id + " competition result: " + winner.uid + " vs " + loser.uid + " " + (tie ? "tie" : "win") + "! time=" + formatTime(gametime));
        write_record(id, 'end');
        var data = {
            name: tower_name,
            winner_uid: winner.uid,
            winner_pass: winner.password,
            loser_uid: loser.uid,
            loser_pass: loser.password,
            tie: tie,
            gametime: gametime,
            room_id: id
        }
        axios.post("https://h5mota.com/rank/upload.php", {
            form: data
        }).then((response) => {
            if (response.status === 200) {
                try {
                    log(id + ' uploading status: ' + response.data.msg);
                } catch (e) {
                    log(id + " uploading error " + e);
                }
            }
        }).catch((error) => {
            log(id + ' uploading error: ' + error);
        });
    }

    tower.on('connection', function (socket) {

        _update_rooms();

        var wait = function (socket, mode) {
            var name = mode == 2 ? 'competition' : 'waiting'

            if (!tower.adapter.rooms[name]) {
                log(name + ' '+socket.id);
                socket.join(name);
                _update_rooms();
                return;
            }

            var room = tower.adapter.rooms[name];

            if (room.length > 0) {
                var temp = socket.connected[Object.keys(room.sockets)[0]];

                var rand = ~~(Math.random() * 2147483647) + 100;
                do {
                    rand = ~~(Math.random() * 2147483647) + 100;
                    if (tower.adapter.rooms[rand] || fs.existsSync('records/'+rand+'.h5record')) continue;
                    break;
                } while (true);

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
                _update_rooms();
                return;
            }

            socket.join(name);
            _update_rooms();
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
                first = socket.connected[Object.keys(room.sockets)[0]];
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
            uid = parseInt(uid) || 0;
            if (room.competition && !(uid && uid != 3266 && password)) {
                tower.in(id).emit('error', '无效的对局：未知用户');
                return;
            }

            room.count = room.count || 0;
            room.players = room.players || {};
            room.count++;
            if (room.version && room.version != version) {
                log(id + " version mismatch: " + room.version + " vs " + version);
                tower.in(id).emit('error', '双方版本不一致。\n请强制刷新浏览器后重试。');
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
                room.started = true;
                room.startTime = new Date();
                write_record(id, id + " " + room.players[room.first].uid + " " + room.players[room.second].uid);
            }

            _update_rooms();
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
            if (id == null) return _update_rooms();
            tower.in(id).emit('error', '对方断开了链接');
            log(id+" disconnect: "+socket.id);

            var room = tower.adapter.rooms[id];
            if (room == null) return _update_rooms();
            if (room.competition && room.started && room.players && room.players[socket.id]) {
                var winner = null, loser = null;
                for (var player in room.players) {
                    if (player == socket.id) loser = room.players[player];
                    else winner = room.players[player];
                }
                sendResult(winner, loser, 0, id, Date.now() - room.startTime);
            }
            else if (room.started) {
                write_record(id, "end");
            }
            room.started = false;
            return _update_rooms();
        });

        socket.on('result', function (id, result) {
            var room = tower.adapter.rooms[id];
            if (!room || !room.competition || !room.started) return;

            var _check = function () {
                if (room.winner && room.loser) {
                    sendResult(room.winner, room.loser, 0, id, Date.now() - room.startTime);
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
                    sendResult(room.tie, player, 1, id, Date.now() - room.startTime);
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
            write_record(id, data.toString().replace(/,/g, ' '));
        });

        ["msg", "asktie", "asktie_res", "asklose"].forEach(function (e) {
            socket.on(e, function (id, data) {
                log(id + " [" +e+ "]: " + data);
                tower.in(id).emit(e, data);
            })
        });

        // 观战
        socket.on('watch', function (id) {
            log('[watch] ' + id + ' ' + socket.id);
            if (!fs.existsSync('records/'+id+".h5record")) {
                tower.in(socket.id).emit('error', '对战不存在');
                return;
            }
            tower.in(socket.id).emit('watch', fs.readFileSync('records/'+id+".h5record").toString());
            socket.join('w_'+id);
        })
    });

    return tower;
}