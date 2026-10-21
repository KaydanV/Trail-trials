/** One release gate for local development and CI, with an owned temporary server. */
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const run = async (script, env = {}) => {
  console.log(`\nRunning ${script}`);
  const child = spawn('npm', ['run', script], {cwd, env:{...process.env,...env}, stdio:'inherit'});
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) throw Error(`${script} failed (${signal || code})`);
};
let server;
try {
  for (const script of ['check','check:valley','test','test:valley']) await run(script);
  server = spawn(process.execPath, ['scripts/serve.mjs'], {cwd,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','inherit']});
  const port = await new Promise((resolve,reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(Error('Development server did not start')),15000);
    server.once('error',error => {clearTimeout(timeout);reject(error);});
    server.once('exit',code => {clearTimeout(timeout);reject(Error(`Development server exited (${code})`));});
    server.stdout.on('data',chunk => {output += chunk; const match=output.match(/port (\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});
  });
  const origin = `http://127.0.0.1:${port}`;
  const root = await fetch(origin);
  if (!root.ok || !(await root.text()).includes('living-valley/')) throw Error('The published root must lead to Version 5');
  for (const path of ['classic.html','living-valley/','assets/scenes/alpine-workshop.webp','assets/characters/alpine-party.webp']) {
    if (!(await fetch(`${origin}/${path}`)).ok) throw Error(`Missing release resource: ${path}`);
  }
  for (const script of ['test:browser','test:mobile','test:valley:browser','test:valley:play','test:valley:immersive']) {
    await run(script,{TRAILS_URL:origin});
  }
  console.log('\nVersion 5 release checks passed.');
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {if(server && server.exitCode === null) server.kill();}
