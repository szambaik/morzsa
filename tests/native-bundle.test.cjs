const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');

test('native bundle preserves classic globals, script order and startup side effects',async()=>{
 const {bundleNativeRuntime}=await import('../scripts/native-bundle.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'morzsa-native-'));
 try{
  await fs.mkdir(path.join(root,'mobile'));await fs.mkdir(path.join(root,'out'));
  await fs.writeFile(path.join(root,'first.js'),'const stock={Tej:1}; function count(){return stock.Tej}; window.events=[count()];');
  await fs.writeFile(path.join(root,'second.js'),'stock.Tej++; window.events.push(count()); window.setCount=value=>stock.Tej=value');
  await fs.writeFile(path.join(root,'styles.css'),'@import url(https://fonts.googleapis.com/css2?family=Inter); body{font-family:Inter,system-ui}');
  await fs.writeFile(path.join(root,'mobile/ios.css'),'.native-app button{touch-action:manipulation}');
  const html=await bundleNativeRuntime(root,path.join(root,'out'),'<html><head><link rel="stylesheet" href="styles.css?v=1"></head><body><script src="first.js?v=1"></script><script src="second.js"></script><script>window.events.push(count());</script></body></html>');
  const context=vm.createContext({});context.window=context;vm.runInContext(await fs.readFile(path.join(root,'out/morzsa-app.js'),'utf8'),context);
  assert.deepEqual(Array.from(context.events),[1,2,2]);assert.equal(context.count(),2);context.setCount(4);assert.equal(context.count(),4);
  assert.equal((html.match(/<script /g)||[]).length,2);assert.ok(html.indexOf('native-bridge.js')<html.indexOf('morzsa-app.js'));
  const css=await fs.readFile(path.join(root,'out/morzsa-app.css'),'utf8');assert.ok(!css.includes('googleapis'));assert.ok(css.includes('-apple-system'));assert.ok(css.includes('touch-action:manipulation'));
 }finally{await fs.rm(root,{recursive:true,force:true})}
});

test('native bundling rejects script paths that would escape the curated runtime',async()=>{
 const {bundleNativeRuntime}=await import('../scripts/native-bundle.mjs');
 await assert.rejects(()=>bundleNativeRuntime('.',os.tmpdir(),'<script src="../outside.js"></script>'),/Unexpected native script/);
 await assert.rejects(()=>bundleNativeRuntime('.',os.tmpdir(),'<script src="https://example.test/app.js"></script>'),/Unexpected native script/);
});

test('native startup keeps an async checkpoint before loading proactive suggestions',async()=>{
 const {bundleNativeRuntime}=await import('../scripts/native-bundle.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'morzsa-native-'));
 try{
  await fs.mkdir(path.join(root,'mobile'));await fs.mkdir(path.join(root,'out'));await fs.writeFile(path.join(root,'mobile/ios.css'),'');
  await fs.writeFile(path.join(root,'core.js'),'window.events=["core"];Promise.resolve().then(()=>window.events.push("ready"));');
  await fs.writeFile(path.join(root,'proactive-model.js'),'window.events.push("suggestions");');
  const html=await bundleNativeRuntime(root,path.join(root,'out'),'<html><head></head><body><script src="core.js"></script><script src="proactive-model.js"></script></body></html>');
  const context=vm.createContext({});context.window=context;
  for(const name of ['morzsa-app.js','morzsa-suggestions.js']){vm.runInContext(await fs.readFile(path.join(root,'out',name),'utf8'),context);await Promise.resolve()}
  assert.deepEqual(Array.from(context.events),['core','ready','suggestions']);assert.equal((html.match(/<script /g)||[]).length,3);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
