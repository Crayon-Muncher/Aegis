var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req,res) {
	res.sendFile(__dirname + '/client/index.html');
});

app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server Started");

var SOCKET_LIST = {};
var PLAYER_LIST = {};

var Entity = function(){
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	return self;
}

var Player = function(id){

	var self = Entity();
	self.id = id;
	self.num = "" + Math.floor(10 * Math.random());
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingLeft = false;
	self.pressingRight = false;
	self.pressingLeftMouse = false;
	self.mouseAngle = 0;
	self.maxSpd = Math.floor(30 * Math.random());

	var super_update = self.update;
	self.update = function() {
		self.updateSpd();
		super_update();
		
		if(self.pressingLeftMouse){
			self.shootBullet(self.mouseAngle);
		}

	}
	
	self.shootBullet = function(angle){
		var b = Bullet(angle);
		b.x = self.x;
		b.y = self.y;
	}

	self.updateSpd = function(){
		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;
		if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else if(self.pressingRight)
			self.spdX = self.maxSpd;
		else
			self.spdX = 0;
	}
	Player.list[id] = self;
	return self;
}

Player.list = {};

Player.onConnect = function(socket){
	console.log('Player Connected');
	var player = Player(socket.id);
	socket.on('keyPress',function(data){
		if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if (data.inputId === 'leftmouse')
			player.pressingLeftMouse = data.state;
		else if (data.inputId === 'mouseangle')
			player.mouseAngle = data.state;
	});
}

Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	
}

Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push({
			x:player.x,
			y:player.y,
			num:player.num
		});

	}
return pack;
}

var Bullet = function(angle){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;

	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();
	}
	Bullet.list[self.id] = self;
	return self;
}

Bullet.list = {};

Bullet.update = function(){
	
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		pack.push({
			x:bullet.x,
			y:bullet.y,
		});

	}
return pack;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection',function(socket){
	socket.id = Math.random();
	socket.x = 0;
	socket.y = 0;
	SOCKET_LIST[socket.id] = socket;


	Player.onConnect(socket);
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	
	socket.on('sendMsgToServer',function(data){
		var playerName = ("" + socket.id).slice(2,7);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',playerName + ': ' + data);
		}
	});
	socket.on('evalServer',function(data){
		var res = eval(data);
		socket.emit('evalAnswer',res);
		});
});

setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPosition', pack);
	}

},1000/25);
