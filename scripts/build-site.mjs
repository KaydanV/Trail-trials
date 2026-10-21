/** Stage only public runtime files for GitHub Pages; never publish Git metadata or test output. */
import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist);
for(const name of ['index.html','classic.html','styles.css','.nojekyll','assets','src','styles','living-valley']) {
  await cp(path.join(root,name),path.join(dist,name),{recursive:true,filter:source=>!path.relative(root,source).split(path.sep).includes('tests')});
}
const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const commit=process.env.GITHUB_SHA || execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
await writeFile(path.join(dist,'version.json'),JSON.stringify({version,commit,entry:'living-valley/'},null,2)+'\n');
console.log(`Staged Terminal Trails ${version} (${commit.slice(0,7)}) in dist/`);
