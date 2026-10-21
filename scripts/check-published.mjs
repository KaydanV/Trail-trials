/** Confirm the newly deployed commit, rather than accepting an older cached homepage. */
const [origin,expected]=process.argv.slice(2);
if(!origin || !/^[a-f0-9]{40}$/.test(expected||'')) throw Error('Supply the Pages URL and full release commit');
const url=new URL('version.json',origin.endsWith('/')?origin:origin+'/');url.searchParams.set('release',expected);
let observed='not available';
for(let attempt=0;attempt<12;attempt++) {
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(5000),cache:'no-store'});
    if(response.ok) {
      const version=await response.json();observed=version.commit;
      if(version.version==='5.0.0' && version.commit===expected) {console.log(`Verified live Version ${version.version} at commit ${expected}`);process.exit(0);}
    }else observed=`HTTP ${response.status}`;
  } catch(error) {observed=error.message;}
  if(attempt<11) await new Promise(resolve=>setTimeout(resolve,3000));
}
throw Error(`The published version is not the requested commit: ${observed}`);
