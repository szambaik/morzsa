const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('native OAuth uses PKCE, exact callback, expiry and one-time consumption',async()=>{
 const callbacks={},storage=new Map(),opened=[];const context={window:{},URL,Uint8Array,TextEncoder,crypto:require('node:crypto').webcrypto,btoa:s=>Buffer.from(s,'binary').toString('base64'),localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},Capacitor:{isNativePlatform:()=>true},App:{addListener:(n,f)=>callbacks[n]=f,getLaunchUrl:async()=>null},Browser:{open:async v=>opened.push(v),close:async()=>{}}};
 vm.runInNewContext(fs.readFileSync('mobile/bridge.js','utf8').replace(/^import .*;\n/gm,''),context);
 const native=context.window.MorzsaNative;await native.signIn(new URL('https://project.supabase.co/auth/v1/authorize?provider=google'));
 const u=new URL(opened[0].url);assert.equal(u.searchParams.get('redirect_to'),native.callback);assert.equal(u.searchParams.get('code_challenge_method'),'s256');assert.match(u.searchParams.get('code_challenge'),/^[A-Za-z0-9_-]{43}$/);assert(!opened[0].url.includes('verifier'));
 let calls=0;await native.onAuth(async url=>{calls++;const body=await native.consume(url);assert.equal(body.auth_code,'abc');assert.equal(body.code_verifier.length,64)});
 await callbacks.appUrlOpen({url:'https://attacker.example/auth-callback?code=abc'});assert.equal(calls,0);
 await callbacks.appUrlOpen({url:native.callback+'?code=abc'});await callbacks.appUrlOpen({url:native.callback+'?code=abc'});assert.equal(calls,1);await assert.rejects(native.consume(native.callback+'?code=abc'));
 storage.set('morzsa-native-pkce',JSON.stringify({verifier:'v',at:Date.now()-700000}));await assert.rejects(native.consume(native.callback+'?code=late'));
});
