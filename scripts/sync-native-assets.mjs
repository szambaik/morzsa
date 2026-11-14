// Fast frontend-only iteration. Run full cap sync after native plugin/config changes.
import {access,cp,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),source=path.join(root,'dist');
const html=await readFile(path.join(source,'index.html'),'utf8');
if(!html.includes('native-bridge.js'))throw Error('Build the native web bundle first.');
for(const target of ['ios/App/App/public','android/app/src/main/assets/public']){
 const dest=path.join(root,target);await access(path.dirname(dest));
 // Preserve Capacitor-generated bridge and plugin files already in each project.
 await cp(source,dest,{recursive:true});
 if(await readFile(path.join(dest,'index.html'),'utf8')!==html)throw Error('Copy verification failed: '+target);
 console.log('Updated native web assets: '+target);
}
