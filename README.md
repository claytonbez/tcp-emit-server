# tcp-emit-server
#### v0.0.1a ~ Seriously just mushed this together, still needs proper testing. And still busy doing active work on it. 

_This module works in conjunction with tcp-emit-client.js_

Inspired by the ease of application of Socket.io. This is an event emitter based tcp server manager built using the net module native to NodeJS. It handles emit on all sockets, single sockets or rooms. Management of the connections are taken care of in the module.
##### Extra Features
`Built into the server and client module is the ability to send and receive files using the .fileSend() method. This is a controlled buffer over TCP/IP read and write using only the 'fs' modules read and write streams.`
## Installation
`npm install tcp-emit-server -save`
## Getting Started
##### Here is a quick server example.
```javascript
var tcpserver = require('tcp-emit-server');
var server = new tcpserver('127.0.0.1',3000);

server.on('connection',function(socket){

    console.log(`Socket ${socket.ipaddress}:${socket.ipport} connected`);
    //you can create any listener you like, ie. 'register'
    socket.on('register',function(username,password){ 
    	console.log(`Registering ${username},${password}`);
        socket.emit('register-done');
    });
    //here is native events that emit on the socket object
    socket.on('data',function(buffer){
    	var data = buffer.toString();
    	console.log(`RAW SOCKET DATA: ${data}`);
    });
    socket.on('disconnect',function(){
    	console.log(`Socket ${socket.ipaddress}:${socket.ipport} DISCONNECTED`);
    });
    socket.on('err',function(err){
    	console.log(err); 
        //when sockets don't close properly, this event will be emitted along side the disconnect event.
	});
    
});

```
##### Below is a tcp-emit-client sample to connect to the server code above.
`npm install tcp-emit-client`

```javascript
var tcpclient = require('tcp-emit-client');
var socket = new tcpclient('127.0.0.1',3000);

socket.on('connect',function(){
    console.log('connected to server');
    socket.emit("register","myudername","mypassword");
});
socket.on('data',function(buffer){
	//use this method is you purely want to read data received on the tcp socket.
    var data = buffer.toString();
    console.log(`RAW SOCKET DATA: ${data}`);
});
socket.on('register-done',function(){
    console.log("This client has been registered");
    socket.close(); //closes the tcp connection to the server and destroyed all socket objects
});
socket.on('disconnect',function(){
    console.log('Disconnected From Server');
});
socket.on('reconnect',function(){
    console.log('Reconnecting to Server');
});
socket.on('err',function(err){
    console.log(err);
});
```

# Basic Server Methods

### - Create TCP Server Object
#### `new tcpserver(server_ip_address,port_to_run_on);`

```javascript
var tcpserver = require('tcp-emit-server');
var server = new tcpserver('127.0.0.1',3000);
```
### - Connection Event
#### `serverObject.on('connect',function(){});`

```javascript
var tcpserver = require('tcp-emit-server');
var server = new tcpserver('127.0.0.1',3000);

server.on('connection',function(socket){
    //This event gets triggered each time a new socket is connected and is
    //where you will handle most of your server-client messaging
});
```
### - Emit to All Sockets connected to serverObject
#### `serverObject.emit('yourEvent',dataObj,str,integer);`

```javascript
var tcpserver = require('tcp-emit-server');
var server = new tcpserver('127.0.0.1',3000);

server.on('connection',function(socket){
     socket.on('data',function(buffer){
    	var data = buffer.toString();
    	console.log(`RAW SOCKET DATA: ${data}`);
    });
    socket.on('disconnect',function(){
    	console.log(`Socket ${socket.ipaddress}:${socket.ipport} DISCONNECTED`);
    });
    socket.on('err',function(err){
    	console.log(err); 
        //when sockets don't close properly, this event will be emitted along side the disconnect event.
	});
});
```
### - SocketObject
#### `socket.on('yourEvent',function(data1,data2,data3){});`
Gets passed via the connection event and can only be used inside its scope.
```javascript
var tcpserver = require('tcp-emit-server');
var server = new tcpserver('127.0.0.1',3000);

server.on('connection',function(socket){
//The socket object itself is an event emitter and has certian native events that you can listen for. 
    socket.on('message',function(stringMessage){
    	server.emit('broadcaseMessage',stringMessage); 
        //Emitting on Server object sends to all sockets connected. Even the socket that emitted the 'message'
    });
});
```
#### `socket.emit('yourEvent',data1,data2,data3);`
Emitting on the socket object itself sends the event and data to the single socket instance only
```javascript
var tcpserver = require('tcp-emit-server');
var server = new tcpserver('127.0.0.1',3000);

server.on('connection',function(socket){
//The socket object itself is an event emitter and has certian native events that you can listen for. 
    socket.on('message',function(stringMessage){  
    	server.emit('broadcaseMessage',stringMessage); 
        //Emitting on Server object sends to all sockets connected. Even the socket that emitted the 'message'
    });
});
```
#### Rooms
	socket.join('room');
		- Adds the current Socket to a defined room
	socket.leave('room');
		- Removes the current Socket from a defined room
	socket.emitIn('roomName','Data to Send');
		- Sends a message to all sockets in the room except the originator
	socket.broadcasts('roomName','Data To SEND TO ALL');
		- Sends a message to all sockets in the room including the originator

	You may also broadcast messages from the serverObject to a room
    
    	server.broadcast('roomName',data1,data2,data3); 
Any socket can be added to a room by calling this method. This enables you to emit data to a group of sockets. Here is an example of usage.
```javascript
var tcpserver = require('tcp-emit-server');
var server = new tcpserver('127.0.0.1',3000);

server.on('connection',function(socket){
	//You must create the method of knowing when to add a socket to a group. 
    //"Chat Rooms" are a great examples of grouping sockets.
    socket.on('join-my-room',function(roomName){
    	socket.join(roomName);
        //This socket is now part of a room
    });
    socket.on('leave-my-room',function(roomName){
    	socket.leave(roomName);
        //This socket is now removed from the room
    });
    socket.on('message-all',function(room,message){
    	socket.emitIn(room,message); 
        //socketObj.emitIn(roomName,dataToSend,data2,data3); send to everyone in the room except the originator
	});
    socket.on('message-alert',function(room,message){
    	socket.broadcast(room,message); 
        //socketObj.broadcast(roomName,dataToSend,data2,data3); send to everyone in the room including the originator
	});
});
//serverObject.broadcast(roomName,dataToSend,data2,data3); sensd to everyone in the room
```

#### File Transfer Methods
	socket.fileSend('path/to/file.txt');
		- Emits on the 'file' event on the client side. Starts and manages transmission of files between server and client.
		- Both modules uses the same method
	socket.on('getfile',function(filename){});
		- Emits on the 'getfile' event on the client side. Starts and manages transmission of files between server and client.
		- Both modules uses the same method
	
Here is an Example of Server sending files to a client. Same methods are available for send and receive on the server and client.
```javascript
//SERVER SCRIPT
var tcp = require('tcp-emit-server');
var server = new tcp('127.0.0.1',3000);

server.on('connection',function(socket){

	socket.on('myfileRequestEvent', function (filename) {
        console.log("file requested:", filename);
        socket.sendFile("relative/path/to/file/"+filename);
    });
    
});

//CLIENT SCRIPT
var tcpclient = require('tcp-emit-client');
var socket = new tcpclient('127.0.0.1',3000);

socket.on('connect', function () {
	//Requests The File On Connection to Server
	socket.emit('myFileRequestEvent','sampleFile.txt');
});
socket.on('file', function (file) {
	//the object passed via the file event contains a file.filename and file.size property you can access.
    var fn = file.filename;
    var size = file.size;
    var f = fs.createWriteStream('relative/path/to/save/directory/' + fn);
    file.on('data', function (buffer) {
    	//as data arrives for this file object, a buffer will be passed in on the 'data' event.
    	f.write(buffer);
    });
    file.on('end', function () {
    	//when data has been 
    	console.log('File Received');
    });
});    
```
