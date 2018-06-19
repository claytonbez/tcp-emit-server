var util = require('util');
var fs = require('fs');
var path = require('path');
var EventEmitter = require('events').EventEmitter;
var SocketEmitter = require('events').EventEmitter;
var net = require('net');
var server;
var sockets = [];
var rawsockets = []; 
var rooms = [];
var brStr = "~!";
function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 32; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}
function roomClean(room,id){
    for (var i = 0; i < rooms[room].length; i++) {
            var key = rooms.indexOf(room);
            var indexId = rooms[room].indexOf(id);
            if(indexId !== -1){
                rooms[room].splice(indexId, 1);
            }
            if (Object.keys(room).length == 0) {
                rooms.splice(key, 1);
                delete (rooms[key]);
            }
        }
}
function cleanup(id){
    delete (rawsockets[id]);
    delete (sockets[id]);
    Object.keys(rooms).forEach(function (key) {
        roomClean(key,id);
    });
    
    return;
}
var socket = function () {};
util.inherits(socket, SocketEmitter);
var sc = '';
var ec = '';
var fileHolders = []; 
var file = function (fn) {
    this.filename = fn;
}
util.inherits(file, EventEmitter);
var _f = {
    create : function(addr,port){
        var err;
        this.oldEmit = this.emit;
        this.emit = function (evt,data,data2,data3) {
            // console.log(evt, data, data2, data3) ;
            var keys = Object.keys(sockets);
            for(var i = 0; i < keys.length;i++){
                var key = keys[i];
                sockets[key].emit(evt,data,data2,data3);
            }
        };
        this.broadcast = function(room,evt,data){
            if(rooms[room].length !== 0){
                rooms[room].forEach(function(id){
                    sockets[id].emit(evt, data);
                });
            }
        };
        this.emitIn = function(sockid,room,evt,data){
            if (rooms[room].length !== 0) {  
                rooms[room].forEach(function (id) {
                    if (id !== sockid) {
                        sockets[id].emit(evt, data);
                    }
                });
            }
        };
        this.setBreakStr = function (str) {
            brStr = str;
        };
        this.setStartChar = function(str) {
            sc = str;
        };
        this.setEndChar =function(str) {
            ec = str;
        };
        var self = this;
        try {
            server = net.createServer(function (s) {
                (function(){
                    
                    var sobj = {};
                    sobj.id = makeid();
                    rawsockets[sobj.id] = s;
                    sockets[sobj.id] = sobj;
                    var id = sobj.id;

                    sockets[id] = new socket();
                    sockets[id].id = id
                    sockets[id].oldEmit = sockets[id].emit;
                    sockets[id].ipaddress = s.remoteAddress;
                    sockets[id].ipport = s.remotePort;
                    sockets[id].emit = function (evt, data,data2,data3) {
                        sockets[id].oldEmit('msg', evt,data,data2,data3);
                    };
                    sockets[id].emitIn = function (room,evt, data,data2,data3) {
                        self.emitIn(id,room, evt, data,data2,data3);
                    };
                    sockets[id].join = function(room){
                        if(rooms[room] == undefined){
                            rooms[room] = [];
                        }
                        try{
                            var add = 1 ; 
                            for(var i = 0 ; i < rooms[room].length;i++){
                                if (rooms[room][i] == sockets[id].id){
                                    add = 0 ; 
                                }
                            }
                            if(add){
                                rooms[room].push(sockets[id].id);
                            }
                     
                        }catch(e){}
                    }
                    sockets[id].leave = function(room){
                        console.log('Leave room ',room,id);
                        roomClean(room,id);
                    }
                    sockets[id].sendFile = function(file)
                    {
                         
                        try{
                            var rs = fs.createReadStream(file);
                            rawsockets[sockets[id].id].write(`^o${brStr}${file}`);
                            rs.on('data', function (buffer) {
                                var b = buffer.toString('utf8');
                                rawsockets[sockets[id].id].write(`^d${brStr}${file}${brStr}${b}`);
                            });
                            rs.on('close', function () {
                                console.log('file closed');
                                setTimeout(function () {
                                    rawsockets[sockets[id].id].write(`^c${brStr}${file}`);
                                }, 500);

                            });
                        }catch(e){}
                        
                    }
                    rawsockets[sockets[id].id].on('data', function (buffer) {
                        var data = buffer.toString();
                        sockets[id].oldEmit('data', data);
                        var d = data.split(brStr);
                        switch (d[0]) {
                            case "^o":
                                console.log('openfile')
                                var fn = d[1]
                                fileHolders[fn] = new file(fn);
                                self.oldEmit('file', fileHolders[fn]);
                                break;
                            case "^d":
                                var fn = d[1]
                                var buffer = Buffer.from(d[2], 'utf8')
                                fileHolders[fn].emit('data', buffer);
                                break;
                            case "^c":
                                var fn = d[1]
                                fileHolders[fn].emit('end');
                                var i = fileHolders.indexOf(fileHolders[fn]);
                                fileHolders.splice(i, 1);
                                break;
                            default:
                                if (d.length == 2) {
                                    var evt = d[0];
                                    var sendData = d[1];
                                    try { sendData = JSON.parse(sendData); }
                                    catch (e) { }
                                    sockets[id].oldEmit(evt, sendData);
                                }
                                if (d.length == 3) {
                                    var evt = d[0];
                                    var sendData = d[1], sendData2 = d[2];
                                    try { sendData = JSON.parse(sendData); } catch (e) { }
                                    try { sendData2 = JSON.parse(sendData2); } catch (e) { }
                                    sockets[id].oldEmit(evt, sendData, sendData2);
                                }
                                if (d.length == 4) {
                                    var evt = d[0];
                                    var sendData = d[1], sendData2 = d[2], sendData3 = d[3];
                                    try { sendData = JSON.parse(sendData); } catch (e) { }
                                    try { sendData2 = JSON.parse(sendData2); } catch (e) { }
                                    try { sendData3 = JSON.parse(sendData3); } catch (e) { }
                                    sockets[id].oldEmit(evt, sendData, sendData2, sendData3);
                                }

                        }
                        if (d.length == 2) {
                            var evt = d[0];
                            var sendData = d[1];
                            try {sendData = JSON.parse(sendData);}
                            catch (e) { }
                            sockets[id].oldEmit(evt, sendData);
                        }
                        if (d.length == 3) {
                            var evt = d[0];
                            var sendData = d[1], sendData2 = d[2];
                            try { sendData = JSON.parse(sendData);}catch (e) { }
                            try {sendData2 = JSON.parse(sendData2);}catch (e) { }
                            sockets[id].oldEmit(evt, sendData,sendData2);
                        }
                        if (d.length == 4) {
                            var evt = d[0];
                            var sendData = d[1], sendData2 = d[2], sendData3 = d[3];
                            try { sendData = JSON.parse(sendData);}catch (e) { }
                            try {sendData2 = JSON.parse(sendData2);}catch (e) { }
                            try {sendData3 = JSON.parse(sendData3);}catch (e) { }
                            sockets[id].oldEmit(evt, sendData,sendData2,sendData3);
                        }
                        
                    });
                    rawsockets[sockets[id].id].on('error', function (error) {
                        if(sockets[id]){
                            sockets[id].oldEmit('err', error);
                        }
                        
                    });
                    rawsockets[sockets[id].id].on('close', function () {
                        sockets[id].oldEmit('disconnect');
                        (function(){
                            var i = id;    
                            setTimeout(function () {
                                cleanup(i);
                            },200);                
                        })();

                    });
                    sockets[id].on('msg', function (event,data,data2,data3) {
                        var strConst = `${event}${brStr}`
                        try {
                            data = JSON.stringify(data);
                        } catch (e) { }
                        strConst += `${data}`;
                        if (data2) {
                            try {
                                data2 = JSON.stringify(data2);
                            } catch (e) { }
                            strConst += `${brStr}${data2}`;
                        }
                        if (data3) {
                            try {
                                data3 = JSON.stringify(data3);
                            } catch (e) { }
                            strConst += `${brStr}${data3}`;
                        }

                        rawsockets[sockets[id].id].write( sc + strConst + ec) ;
                    });
                    self.oldEmit('connection', sockets[id]);              
                })();
                
            });
            server.listen(port, addr,function(){
                self.oldEmit('start', { addr: addr, port: port });
            });
            server.on('close',function(){
                self.oldEmit('close');
            })
            server.on('error',function(err){
                self.oldEmit('error',err);
            });
        } catch (e) {
            err = e;
            self.oldEmit('error', err);
        }
    }
}
util.inherits(_f.create, EventEmitter);
module.exports = _f.create;