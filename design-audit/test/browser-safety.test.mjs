import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startFixture,actors} from '../fixture.mjs';
import {runBrowser} from '../browser.mjs';

test('fixture serves only UI assets, substitutes cloud config and blocks external-effect RPCs',async()=>{
 const fixture=await startFixture();
 try{
  for(const file of ['/.env','/server.py','/package.json','/.git/config','/design-audit/fixture.mjs'])assert.equal((await fetch(fixture.origin+file)).status,404,file);
  const config=await(await fetch(fixture.origin+'/household-config.js')).text();assert(config.includes(fixture.origin));assert(config.includes('audit-synthetic-only'));assert(!config.includes('supabase.co'));
  const index=await(await fetch(fixture.origin)).text();const scripts=[...index.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);assert(scripts.length>40);for(const script of scripts)assert.equal((await fetch(fixture.origin+'/'+script)).status,200,script);
  const denied=await fetch(fixture.origin+'/rest/v1/rpc/send_household_email_invite',{method:'POST',headers:{Authorization:'Bearer audit-a','Content-Type':'application/json'},body:JSON.stringify({recipient_email:'nobody@audit.invalid'})});assert.equal(denied.status,403);assert.equal(fixture.unexpected.length,1);
  const guest=await fetch(fixture.origin+'/rest/v1/households');assert.equal(guest.status,400); // schema denies anonymous household reads
  const c=await fetch(fixture.origin+'/rest/v1/households',{headers:{Authorization:'Bearer audit-c'}});assert.deepEqual(await c.json(),[]);assert(actors.c);
 }finally{await fixture.close()}
});

test('browser rerun refuses to overwrite existing evidence before browser launch',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'morzsa-audit-immutable-'));fs.mkdirSync(path.join(dir,'evidence'));const saved=path.join(dir,'evidence','results.json');fs.writeFileSync(saved,'{"previous":true}');
 try{await assert.rejects(runBrowser({runDir:dir}),/already exists/);assert.equal(fs.readFileSync(saved,'utf8'),'{"previous":true}')}
 finally{fs.rmSync(dir,{recursive:true,force:true})}
});
