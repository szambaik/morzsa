// Isolated native-adapter regression suite; all service calls use the local fixture.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../design-audit/package.json',import.meta.url));
const {chromium}=require('playwright');
const root=path.resolve(import.meta.dirname,'..');
const reservation=net.createServer();
await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;
await new Promise(resolve=>reservation.close(resolve));
const base='http://127.0.0.1:'+port;
const fixture=spawn(process.execPath,['tests/persistence-fixture.mjs'],{cwd:root,env:{...process.env,MORZSA_QA_PORT:String(port),MORZSA_QA_PROACTIVE:'1'},stdio:['ignore','pipe','pipe']});
let browser,logs='';fixture.stdout.on('data',data=>logs+=data);fixture.stderr.on('data',data=>logs+=data);
try{
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  if(fixture.exitCode!==null)throw Error('Fixture exited: '+logs);
  try{ready=(await fetch(base+'/qa/status',{signal:AbortSignal.timeout(500)})).ok}catch{}
  if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!ready)throw Error('Fixture did not become ready: '+logs);
 browser=await chromium.launch({headless:true,channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')||route.request().url().startsWith('data:')?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 process.env.MORZSA_QA_BASE=base;
 const run=eval('('+fs.readFileSync(path.join(root,'tests/ios-controls.browser.js'),'utf8')+')');
 const result=await run(page);
 if(errors.length)throw Error('Browser errors: '+errors.join('; '));
 if(process.argv[2]){fs.mkdirSync(process.argv[2],{recursive:true});fs.writeFileSync(path.join(process.argv[2],'results.json'),JSON.stringify(result,null,2))}
 console.log('iOS controls passed: '+result.count+' checks.');
}finally{await browser?.close();fixture.kill('SIGTERM')}
