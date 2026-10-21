import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    let pathname=decodeURIComponent(url.pathname);
    if(pathname.includes('\0'))throw Error('Invalid path');
    const target=path.resolve(root,'.'+pathname);
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const relative=path.relative(root,target);
    if(relative.split(path.sep).some(part=>part.startsWith('.'))||relative.startsWith('node_modules')){res.writeHead(404);res.end('Not found');return;}
    const file=(await stat(target)).isDirectory()?path.join(target,'index.html'):target;
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(content);
  } catch {res.writeHead(404);res.end('Not found');}
});
const port=Number(process.env.PORT||4173);
server.listen(port,'0.0.0.0',()=>console.log(`Terminal Trails development server on port ${server.address().port}`));
