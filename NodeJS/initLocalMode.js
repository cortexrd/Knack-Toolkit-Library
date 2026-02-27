const fs = require('fs');
const path = require('path');
const https = require('https');

const root = process.cwd();
const repoBase = 'https://raw.githubusercontent.com/cortexrd/Knack-Toolkit-Library/dev';

const files = [
  { remote: 'KTL.js', local: 'Lib\\KTL\\KTL.js' },
  { remote: 'KTL.css', local: 'Lib\\KTL\\KTL.css' },
  { remote: 'KTL_Defaults.js', local: 'Lib\\KTL\\KTL_Defaults.js' },
  { remote: 'FileServer.bat', local: 'Lib\\KTL\\FileServer.bat' },
  { remote: 'NodeJS/NodeJS_FileServer.js', local: 'Lib\\KTL\\NodeJS\\NodeJS_FileServer.js' },
  { remote: 'NodeJS/KTL_MCP_Server.js', local: 'Lib\\KTL\\NodeJS\\KTL_MCP_Server.js' }
];

fs.mkdirSync(path.join(root, 'KnackApps'), { recursive: true });
fs.mkdirSync(path.join(root, 'Lib\\KTL\\NodeJS'), { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(resolve); });
    }).on('error', reject);
  });
}

(async () => {
  for (const file of files) {
    const url = `${repoBase}/${file.remote}`;
    const dest = path.join(root, file.local);
    console.log(`Downloading: ${path.basename(file.local)}`);
    await download(url, dest);
  }
  console.log('\nKTL setup complete!');
})();
