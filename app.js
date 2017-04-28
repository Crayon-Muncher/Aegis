var app = require('http').createServer(handler)
	, io = require('socket.io').listen(app)
	, fs = require('fs')

app.listen(3000);

function handler (req, res) {
	fs.readFile(_dirname + '/index.html',
	function (err, data) {
		if(err) {
			res.writehead(500);
			return res.end('Error loading index.html');
		}

		res.writeHead(200);
		res.end(data);
	});
}
