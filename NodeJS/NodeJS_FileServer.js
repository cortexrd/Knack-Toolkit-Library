//Non-secure HTTP server, to be used on local network for development purpose only.
const fs = require('fs');
const http = require('http');
const path = require('path')

console.log('Starting server, waiting for requests...');

const root = process.argv[2] || path.join(process.cwd(), '..', '..');

console.log(`Serving files from ${root}`);

http.createServer(function (req, res) {
    var url = root + req.url;
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
