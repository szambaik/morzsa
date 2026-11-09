import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
if(Capacitor.isNativePlatform()){
 const callback='io.github.szambaik.morzsa://auth-callback',storageKey='morzsa-native-pkce';
 let handler,pending;const seen=new Set();
 const receive=async url=>{
  let u;try{u=new URL(url)}catch{return}if(u.protocol!=='io.github.szambaik.morzsa:'||u.hostname!=='auth-callback'||u.pathname&&u.pathname!=='/')return;
  const code=u.searchParams.get('code')||u.searchParams.get('error');if(!code||seen.has(code))return;seen.add(code);if(seen.size>10)seen.delete(seen.values().next().value);if(handler)await handler(url);else pending=url;
 };
 window.MorzsaNative={
  callback,
  async signIn(url){
   const bytes=crypto.getRandomValues(new Uint8Array(32)),verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
   const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   localStorage.setItem(storageKey,JSON.stringify({verifier,at:Date.now()}));
   url.searchParams.set('redirect_to',callback);url.searchParams.set('flow_type','pkce');url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','s256');
   await Browser.open({url:url.href});
  },
  async consume(url){
   const u=new URL(url);const raw=localStorage.getItem(storageKey);localStorage.removeItem(storageKey);
   const saved=JSON.parse(raw||'null');if(!saved||Date.now()-saved.at>600000||!u.searchParams.get('code')||u.searchParams.has('error'))throw Error('Invalid sign-in callback');
   return {auth_code:u.searchParams.get('code'),code_verifier:saved.verifier};
  },
  async onAuth(fn){handler=fn;if(pending){const url=pending;pending=null;await fn(url)}},
  closeBrowser:()=>Browser.close().catch(()=>{})
 };
 App.addListener('appUrlOpen',({url})=>receive(url));
 App.getLaunchUrl().then(value=>{if(value?.url)receive(value.url)});
 App.addListener('backButton',({canGoBack})=>{const dialog=document.querySelector('dialog[open]');if(dialog){if(dialog.requestClose)dialog.requestClose();else{const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close()}return}if(canGoBack)history.back();else App.minimizeApp()});
}
