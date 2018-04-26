//Environment Variables
require('dotenv').config();

var dbuser = process.env.DBUSERNAME;
var dbpass = process.env.DBPASSWORD;

//Database connection
var mongoose = require('mongoose');
mongoose.connect(`${dbuser}:${dbpass}@ds137110.mlab.com:37110/aegis`)
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('openUri', function(){
	console.log('Connected to Database');
});

var accSchema = mongoose.Schema({
	username: String,
	password: String,
});

var account = mongoose.model('Account', accSchema);

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

var Entity = function(param){
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
		map:'forest',
	}

	if(param){
		if(param.x)
			self.x = param.x;
		if(param.y)
			self.y = param.y;
		if(param.map)
			self.map = param.map;
		if(param.id)
			self.id = param.id;
	}

	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}

	return self;
}

var Player = function(param){
	var self = Entity(param);
	//self.id = param.id;

	//Character Stats
	//These will eventually be initially determined by class and race
	//Modified as the character levels up
	//We're starting with a Barbarian class as the base for now,
	//He starts with 100 stat points at level 1, this is temporary:
	self.agi = 15;
	self.dex = 15;
	self.str = 25;
	self.con = 25;
	self.intl = 10;
	self.wis = 5;
	self.cha = 5;

	self.num = "" + Math.floor(10 * Math.random());
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingLeft = false;
	self.pressingRight = false;
	self.pressingLeftMouse = false;
	self.mouseAngle = 0;
	self.maxSpd = (self.agi + self.dex) - (0.5 * (self.con + self.str));
	self.hpMax = (self.con + self.str);
	self.mpMax = (self.wis + self.intl);
	self.hp = self.hpMax;
	self.mp = self.mpMax;
	self.score = 0;

// HEALTH REGEN
	setInterval(function(){
		if (self.hp < self.hpMax)
		{
			self.hp++;
		}
	},5000);

//  MANA REGEN
	setInterval(function(){
		if (self.mp < self.mpMax)
		{
			self.mp+=(self.wis % 2);
		}
	},3000);

	var super_update = self.update;
	self.update = function() {
		self.updateSpd();
		super_update();

		if(self.pressingLeftMouse){
			if(self.mp > 0)
			{
				self.shootBullet(self.mouseAngle);
				self.mp--;
			}
		}

	}

	self.shootBullet = function(angle){
		var b = Bullet({
			parent:self.id,
			angle:angle,
			x:self.x,
			y:self.y,
			map:self.map,
		});
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

	self.getInitPack = function(){
		return{
			id:self.id,
			x:self.x,
			y:self.y,
			number:self.number,
			hp:self.hp,
			mp:self.mp,
			hpMax:self.hpMax,
			mpMax:self.mpMax,
			score:self.score,
			map:self.map,
		};
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			num:self.num,
			x:self.x,
			y:self.y,
			hp:self.hp,
			mp:self.mp,
			score:self.score,
		};
	}

	Player.list[self.id] = self;
	
		initPack.player.push(self.getInitPack());

	return self;
}

Player.list = {};

Player.onConnect = function(socket){
	console.log('Player Connected');
	var map = 'forest';
	if(Math.random() < 0.5)
		map = 'field';
	var player = Player({
		id:socket.id,
		map:map,
	});
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

	socket.emit('init',{
		selfId:socket.id,
		player:Player.getAllInitPack(),
		bullet:Bullet.getAllInitPack(),
	});
}

Player.getAllInitPack = function(){
	var players = [];
	for(var i in Player.list)
		players.push(Player.list[i].getInitPack());

	return players;
}


Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);

}

Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack());

	}
	return pack;
}

var Bullet = function(param){
	var self = Entity(param);
	self.id = Math.random();
	self.angle = param.angle;
	self.spdX = Math.cos(param.angle/180*Math.PI) * 10;
	self.spdY = Math.sin(param.angle/180*Math.PI) * 10;
	self.parent = param.parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();

		for(var i in Player.list){
			var p = Player.list[i];
			if(self.map === p.map && self.getDistance(p) < 32 && self.parent !== p.id){
				p.hp -= 1;
				if(p.hp <= 0){
					var shooter = Player.list[self.parent];
					p.hp = p.hpMax;
					p.x = Math.random() * 500;
					p.y = Math.random() * 500;
					if(shooter)
						shooter.score += 1;
				}

				self.toRemove = true;
			}
		}
	}


	self.getInitPack = function(){
		return{
			id:self.id,
			x:self.x,
			y:self.y,
			map:self.map,
		};
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}

	Bullet.list[self.id] = self;
	initPack.bullet.push(self.getInitPack());
	return self;
}

Bullet.list = {};

Bullet.update = function(){

	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove){
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		}else
		pack.push(bullet.getUpdatePack());

	}
	return pack;
}

Bullet.getAllInitPack = function(){
	var bullets = [];
	for(var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());

	return bullets;
}

var isValid = function(data,match){
	account.find({username:data.username,password:data.password}, function(err, accounts) {
		if(err){
			console.log(err);
			match(false);
			return;
		}
		if(accounts.length > 0) {
			match(true);

		}else
			match(false);
	});
}

var addUser = function(data,match){
	account.find({username: data.username}, function(err, accounts) {
		if(err){
			console.log(err);
			match(false);
			return;
		}

		if(accounts.length > 0) {
			match(false);
		}

		else{
			console.log(err);

			var newAccount = new account({username: data.username, password: data.password});

			newAccount.save(function(err, account) {
				if(err){
					console.error(err);
					match(false);
					return
				}

				else{

					match(true);
				}
			});
		}
	});
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection',function(socket){
	socket.id = Math.random();
	//socket.x = 0;
	//socket.y = 0;
	SOCKET_LIST[socket.id] = socket;


	socket.on('signIn',function(data){
		isValid(data, function(success){
			if(success){	
				Player.onConnect(socket);
				socket.emit('signInResponse',{success:true});
			} else {
				socket.emit('signInResponse',{success:false});
			}
		});
	});

	socket.on('signUp',function(data){
		addUser(data, function(success){ 
			if(success){
				socket.emit('signUpResponse',{success:true});
				console.log("Account Created");
			}else{
				socket.emit('signUpResponse',{success:false});
			}
		});	
	});


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

var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};

setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init', initPack);
		socket.emit('update', pack);
		socket.emit('remove', removePack);
	}

	initPack.player = [];
	initPack.bullet = [];
	removePack.player = [];
	removePack.bullet = [];

},1000/25);
