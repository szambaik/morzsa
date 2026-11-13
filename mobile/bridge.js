import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Keyboard} from '@capacitor/keyboard';
import {Clipboard} from '@capacitor/clipboard';
import {Share} from '@capacitor/share';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Network} from '@capacitor/network';
import {SecureStoragePlugin} from 'capacitor-secure-storage-plugin';
import {createVault} from './vault.mjs';
if(Capacitor.isNativePlatform()){
 const callback='io.github.szambaik.morzsa://auth-callback',vault=createVault(SecureStoragePlugin,localStorage);
 document.documentElement.classList.add('native-app');
 let handler,pending;const seen=new Set();
 const receive=async url=>{
  let u;try{u=new URL(url)}catch{return}if(u.protocol!=='io.github.szambaik.morzsa:'||u.hostname!=='auth-callback'||u.pathname&&u.pathname!=='/')return;
  const code=u.searchParams.get('code')||u.searchParams.get('error');if(!code||seen.has(code))return;seen.add(code);if(seen.size>10)seen.delete(seen.values().next().value);if(handler)await handler(url);else pending=url;
 };
 window.MorzsaNative={
  callback,
  loadSession:()=>vault.loadSession(),saveSession:value=>vault.saveSession(value),
  copyText:text=>Clipboard.write({string:text}),
  shareText:payload=>Share.share({...payload,dialogTitle:payload.title}),
  async exportRecipe({name,content,title}){
   if(!/^morzsa-[a-z0-9-]{0,64}\.html$/.test(name)||content.length>4500000)throw Error('Invalid recipe export');
   const file=await Filesystem.writeFile({path:name,data:content,directory:Directory.Cache,encoding:Encoding.UTF8});
   await Share.share({title,files:[file.uri],dialogTitle:title});
  },
  openExternal:async href=>{const url=new URL(href);if(url.protocol!=='https:')throw Error('Unsupported link');await Browser.open({url:url.href})},
  async signIn(url){
   const bytes=crypto.getRandomValues(new Uint8Array(32)),verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
   const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   await vault.saveProof({verifier,at:Date.now()});
   url.searchParams.set('redirect_to',callback);url.searchParams.set('flow_type','pkce');url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','s256');
   await Browser.open({url:url.href});
  },
  async consume(url){
   const u=new URL(url);if(u.protocol!=='io.github.szambaik.morzsa:'||u.hostname!=='auth-callback'||u.pathname&&u.pathname!=='/')throw Error('Invalid sign-in callback');const saved=await vault.takeProof();if(!saved||Date.now()-saved.at>600000||!u.searchParams.get('code')||u.searchParams.has('error'))throw Error('Invalid sign-in callback');
   return {auth_code:u.searchParams.get('code'),code_verifier:saved.verifier};
  },
  async onAuth(fn){handler=fn;if(pending){const url=pending;pending=null;await fn(url)}},
  closeBrowser:()=>Browser.close().catch(()=>{})
 };
 App.addListener('appUrlOpen',({url})=>receive(url));
 App.getLaunchUrl().then(value=>{if(value?.url)receive(value.url)}).catch(()=>{});
 App.addListener('appStateChange',({isActive})=>{window.dispatchEvent(new Event(isActive?'morzsa-resume':'morzsa-pause'));if(isActive)window.dispatchEvent(new Event('online'))});
 Network.addListener('networkStatusChange',({connected})=>window.dispatchEvent(new Event(connected?'online':'offline')));
 Keyboard.addListener('keyboardWillShow',()=>document.documentElement.classList.add('keyboard-open'));
 Keyboard.addListener('keyboardDidHide',()=>document.documentElement.classList.remove('keyboard-open'));
 document.addEventListener('click',e=>{const a=e.target.closest('a[target="_blank"]');if(a?.href.startsWith('https://')){e.preventDefault();window.MorzsaNative.openExternal(a.href).catch(()=>{window.toast?.('Nem sikerült megnyitni / Could not open')})}});
 App.addListener('backButton',({canGoBack})=>{const dialog=document.querySelector('dialog[open]');if(dialog){if(dialog.requestClose)dialog.requestClose();else{const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close()}return}if(canGoBack)history.back();else App.minimizeApp()});
}
