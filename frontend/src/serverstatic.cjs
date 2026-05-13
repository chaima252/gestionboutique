const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIST = path.join(__dirname, 'dist');

http.createServer((req, res) => {
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html');
  const ext = path.extname(filePath);
  const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon'};
  res.writeHead(200, {'Content-Type': mime[ext] || 'text/plain'});
  fs.createReadStream(filePath).pipe(res);
}).listen(PORT, () => console.log('Frontend on port ' + PORT));