//Non-secure HTTP server, to be used on local network for development purpose only.
const fs = require('fs');
const http = require('http');
const path = require('path')

console.log('Starting server, waiting for requests...');

const root = process.argv[2] || path.join(process.cwd(), '..', '..');

console.log(`Serving files from ${root}`);

http.createServer(function (req, res) {
    var url = decodeURI(req.url.split('?')[0]);
    url = root + url;
    url = url.replace(/\\/g, '/');
    url = url.trim();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    fs.readFile(url, function (err, data) {
        const timestamp = new Date().toLocaleString();
        console.log(`[${timestamp}] url =`, url);
        if (err) {
            if (err.code !== 'EISDIR')
                console.log(`[${timestamp}] err =`, err);
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }

        res.writeHead(200);
        res.end(data);
    });
}).listen(3000);