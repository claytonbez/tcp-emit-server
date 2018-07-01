var net = require('net');
var fs = require('fs-extra');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var server;
var sockets = [];
var rawsockets = [];
var rawBuffers = [];
var rawStreams = [];
var fileHolders = [];
var rooms = [];
var connectionCounter = 0;
var ec = String.fromCharCode(13);
function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 32; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}
function roomClean(room, id) {
    for (var i = 0; i < rooms[room].length; i++) {
        var key = rooms.indexOf(room);
        var indexId = rooms[room].indexOf(id);
        if (indexId !== -1) {
            rooms[room].splice(indexId, 1);
        }
        if (Object.keys(room).length == 0) {
            rooms.splice(key, 1);
            delete (rooms[key]);
        }
    }
}
function cleanup(id) {
    delete (rawsockets[id]);
    delete (rawBuffers[id]);
    delete (sockets[id]);
    Object.keys(rooms).forEach(function (key) {
        roomClean(key, id);
    });

    return;
}

var socket = function () { }
util.inherits(socket, EventEmitter);
var file = function () { }
util.inherits(file, EventEmitter);
var stream = function (options) {
    if (!(this instanceof stream))
        return new stream(options);
    Writable.call(this, options);
}
util.inherits(stream, EventEmitter);
var server = function (addr, port) {
    var self = this;
    self.oldEmit = self.emit;
    self.emit = function (event, data) { //SEND TO EVERY SOCKET CONNECTED
        var keys = Object.keys(sockets);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            sockets[key].emit(evt, data);
        }
    }
    self.getRooms = function () {
        return rooms;
    }
    self.getRawSockets = function () {
        return rawsockets;
    }
    self.getSocketObjects = function () {
        return sockets;
    }
    self.getConnectionCount = function () {
        return connectionCounter;
    }
    self.clearConnectionCounter = function () {
        connectionCounter = 0;
    }

    try {
        server = net.createServer(function (s) {
            connectionCounter++;
            (function () {
                var sobj = {};
                sobj.id = makeid();
                console.log('CON ID:' + sobj.id);
                rawsockets[sobj.id] = s;
                rawBuffers[sobj.id] = '';
                sockets[sobj.id] = sobj;
                var id = sobj.id;
                sockets[id] = new socket();
                sockets[id].id = id;
                sockets[id].oldEmit = sockets[id].emit;
                sockets[id].ipaddress = s.remoteAddress;
                sockets[id].ipport = s.remotePort;
                sockets[id].emit = function (evt, data) {
                    sockets[id].oldEmit('msg', evt, data);
                };
                sockets[id].emitIn = function (room, evt, data, ) {
                    self.emitIn(id, room, evt, data);
                };
                sockets[id].join = function (room) {
                    if (rooms[room] == undefined) {
                        rooms[room] = [];
                    }
                    try {
                        var add = 1;
                        for (var i = 0; i < rooms[room].length; i++) {
                            if (rooms[room][i] == sockets[id].id) {
                                add = 0;
                            }
                        }
                        if (add) {
                            rooms[room].push(sockets[id].id);
                        }

                    } catch (e) {
                        console.log(e);
                    }
                }
                sockets[id].leave = function (room) {
                    console.log('Leave room ', room, id);
                    roomClean(room, id);
                }
                sockets[id].sendFile = function (fn, fp, callback) {
                    (function () {
                        var sid = id;
                        fs.stat(fp, function (err, stats) {
                            if (!err) {
                                var obj = { f: fn, fs: stats.size, s: 1 };
                                var out = JSON.stringify(obj) + ec;
                                console.log(`out:${out}`)
                                rawsockets[sid].write(out);
                                var rs = fs.createReadStream(fp);
                                rs.on('data', function (chunk) {
                                    rawsockets[sid].write(JSON.stringify({ f: obj.fn, b: chunk }) + ec);
                                });
                                rs.on('end', function () {
                                    (function () {
                                        var rid = sid;
                                        setTimeout(function () {
                                            rawsockets[rid].write(JSON.stringify({ f: obj.f, c: 1 }) + ec);
                                            callback(true);
                                        }, 500);
                                    })();


                                });
                            } else {
                                sockets[sid].oldEmit('error', err);
                            }
                        });
                    })();
                };
                sockets[id].destroy = function () {
                    rawsockets[sockets[id].id].destroy();
                };
                rawsockets[sockets[id].id].on('data', function (buffer) {
                    var dta = buffer.toString();
                    var lc = dta[dta.length - 1];
                    rawBuffers[sockets[id].id] = rawBuffers[sockets[id].id] + dta;
                    if (lc == String.fromCharCode(13)) {
                        var data = rawBuffers[sockets[id].id];
                        //console.log(data); // DATA INTJECTED PRIOR TO BUFFER OF FILE REACHING END
                        data = data.substring(0, data.length - 1);
                        rawBuffers[sockets[id].id] = ''; //todo : cleanup
                        try {
                            var obj = JSON.parse(data);
                            if (obj.e) {
                                var evt = obj.e;
                                var sd = obj.d;
                                sockets[id].oldEmit(evt, sd);
                            }
                            else {
                                if (obj.f) {
                                    if (obj.s) {

                                        fileHolders[obj.f] = new file(obj.f);
                                        fileHolders[obj.f].filename = obj.f;
                                        fileHolders[obj.f].size = obj.fs;

                                        sockets[id].oldEmit('file', fileHolders[obj.f]);
                                    }
                                    if (obj.b) {
                                        var buffer = Buffer.from(obj.b, 'utf8')
                                        fileHolders[obj.f].emit('data', buffer);
                                    }
                                    if (obj.c) {
                                        fileHolders[obj.f].emit('end');
                                        var i = fileHolders.indexOf(fileHolders[obj.f]);
                                        fileHolders.splice(i, 1);
                                    }
                                }
                            }
                        } catch (err) {
                            sockets[id].oldEmit('error', err);
                        }

                    }
                });
                rawsockets[sockets[id].id].on('error', function (error) {
                    if (sockets[id]) {
                        sockets[id].oldEmit('err', error);
                    }

                });
                rawsockets[sockets[id].id].on('close', function () {
                    sockets[id].oldEmit('disconnect');
                    (function () {
                        var i = id;
                        setTimeout(function () {
                            cleanup(i);
                        }, 200);
                    })();

                });
                sockets[id].on('msg', function (event, data) {
                    var obj = { e: event, d: data };
                    var strConst = JSON.stringify(obj);
                    rawsockets[sockets[id].id].write(strConst + ec);
                });
                //END OF CONNECTION EVENT IN SERVER ---
                sockets[id].join(id);
                self.oldEmit('connection', sockets[id]);
            })();

        });
        server.listen(port, addr, function () {
            self.oldEmit('start', { addr: addr, port: port });
        });
        server.on('close', function () {
            self.oldEmit('close');
        })
        server.on('error', function (err) {
            self.oldEmit('error', err);
        });
    } catch (e) {
        err = e;
        self.oldEmit('error', err);
    }

}
util.inherits(server, EventEmitter);

module.exports = server;