//Non-secure HTTP server, to be used on local network for development purpose only.
var fs = require('fs'),
    http = require('http');

console.log('Starting server, waiting for requests...');

http.createServer(function (req, res) {
    var url = process.cwd() + req.url;
    url = url.replace(/\\/g, '/');
    url = decodeURI(url.trim());
    fs.readFile(url, function (err, data) {
        console.log('url =', url);
        if (err) {
            console.log('err =', err);
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }
        res.writeHead(200);
        res.end(data);
    });
}).listen(3000);
