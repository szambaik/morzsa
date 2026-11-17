import {installIOSControls} from './ios-controls.js';
// Native UIKit controls are optional. A failed bridge always restores the web UI.
export function installIOSUI(plugin) {
 const root=document.documentElement;
 const controls=installIOSControls(plugin);
 let scheduled=false,inFlight=false,last='',enabled=false,sheetOpen=false,disposed=false,failed=false;
 let nativeHeight=0;
 function setHeight(height){
  nativeHeight=Math.max(0,Number(height)||0);
  root.style.setProperty('--native-tabbar-height',nativeHeight+'px');
  if(enabled)root.style.setProperty('--workspace-nav-height',nativeHeight+'px');
 }
 function current(){
  return {page:document.querySelector('.app')?.dataset.page||'chat',language:document.documentElement.lang==='en'?'en':'hu',
   count:Number(document.getElementById('cart-count')?.textContent)||0,
   hidden:root.classList.contains('keyboard-open')||!!document.querySelector('dialog[open]')||
    document.body.classList.contains('introduction-active')||document.body.classList.contains('cooking-guided')||
    !!document.querySelector('.shopping-mode-screen')||!!document.querySelector('#realtime-voice:not([hidden])')};
 }
 function fallback(){
  enabled=false;last='';root.classList.remove('native-tabbar');
  root.style.removeProperty('--native-tabbar-height');
  root.style.setProperty('--workspace-nav-height',(document.querySelector('.app>nav')?.getBoundingClientRect().height||0)+'px');
 }
 async function update(){
  scheduled=false;if(disposed||failed)return;if(inFlight)return;
  const value=current(),key=JSON.stringify(value);
  // Workspace renders can measure the now-hidden DOM navigation. Restore the native inset.
  if(enabled)setHeight(nativeHeight);
  if(key===last)return;
  inFlight=true;
  try{
   const result=await plugin.setNavigation(value);
   if(disposed)return;if(!Number.isFinite(result.height)||result.height<0||result.height>200)throw Error('Invalid native inset');last=key;enabled=true;root.classList.add('native-tabbar');setHeight(result.height);
  }catch{failed=true;fallback()}
  finally{inFlight=false;if(!disposed&&enabled&&JSON.stringify(current())!==last)schedule()}
 }
 function schedule(){if(scheduled||disposed)return;scheduled=true;queueMicrotask(update)}
 const originalMount=window.MorzsaWorkspace?.mount;
 const mount=function(...args){const result=originalMount.apply(this,args);schedule();return result};
 if(originalMount)window.MorzsaWorkspace.mount=mount;
 const originalCount=window.updateCount;
 const updateCount=function(...args){const result=originalCount.apply(this,args);schedule();return result};
 if(originalCount)window.updateCount=updateCount;
 const observer=new MutationObserver(records=>{if(records.some(r=>r.target===root||r.target===document.body||r.target.id==='realtime-voice'||r.attributeName==='open'&&r.target.tagName==='DIALOG'||r.target===counter||counter?.contains(r.target)))schedule()});

 observer.observe(root,{attributes:true,attributeFilter:['class','lang']});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class','hidden']});
 const counter=document.getElementById('cart-count');if(counter)observer.observe(counter,{childList:true,characterData:true,subtree:true});
 function onTab(event){
  const destination=event.page||event.detail?.page;
  if(!enabled||current().hidden||!['overview','shopping','chat','pantry','recipes'].includes(destination))return;
  // Use the existing navigation handler: drafts, active recipes and scroll positions survive.
  document.querySelector('nav [data-page="'+destination+'"]')?.click();schedule();
 }
 function onInsets(event){const height=event.height??event.detail?.height;if(enabled&&Number.isFinite(height)&&height>=0&&height<=200)setHeight(height)}
 function onResume(){last='';failed=false;schedule()}
 async function onClick(event){
  const summary=event.target.closest('.proactive-feedback>summary');
  if(!summary||!enabled)return;
  event.preventDefault();if(sheetOpen)return;
  const details=summary.parentElement,buttons=[...details.querySelectorAll('button')].filter(b=>!b.disabled);
  if(!buttons.length)return;
  const context=document.querySelector('.app')?.dataset.page,card=details.closest('[data-proactive-card]');
  sheetOpen=true;
  try{
   const result=await plugin.showActions({title:card?.querySelector('h3')?.textContent||'Morzsa',actions:buttons.map(b=>b.textContent.trim()),cancel:root.lang==='en'?'Cancel':'Mégse'});
   if(!disposed&&Number.isInteger(result.index)&&result.index>=0&&buttons[result.index]?.isConnected&&!buttons[result.index].disabled&&context===document.querySelector('.app')?.dataset.page)buttons[result.index].click();
  }catch{if(details.isConnected)details.open=true}
  finally{sheetOpen=false;schedule()}
 }
 function onChange(event){
  if(enabled&&event.target.matches('[data-proactive-select],.shopping-row input[type=checkbox]'))plugin.selectionFeedback().catch(()=>{});
 }
 window.addEventListener('morzsa-native-tab',onTab);
 window.addEventListener('morzsa-native-insets',onInsets);
 window.addEventListener('morzsa-resume',onResume);
 document.addEventListener('click',onClick,true);
 document.addEventListener('change',onChange);
 schedule();
 return {refresh(){failed=false;schedule()},dispose(){
  disposed=true;observer.disconnect();controls.dispose();
  window.removeEventListener('morzsa-native-tab',onTab);window.removeEventListener('morzsa-native-insets',onInsets);window.removeEventListener('morzsa-resume',onResume);
  document.removeEventListener('click',onClick,true);document.removeEventListener('change',onChange);
  if(window.MorzsaWorkspace?.mount===mount)window.MorzsaWorkspace.mount=originalMount;
  if(window.updateCount===updateCount)window.updateCount=originalCount;
  plugin.setNavigation({...current(),hidden:true}).catch(()=>{});fallback();
 }};
}
