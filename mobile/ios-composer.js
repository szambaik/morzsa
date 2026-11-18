// Only text editing is native. Photo/voice keep the browser's trusted tap and
// sending still enters the existing form handler and persistence pipeline.
export function installIOSComposer(plugin){
 if(typeof plugin.setComposer!=='function')return {refresh(){},dispose(){}};
 let disposed=false,failed=false,frame=0,inFlight=false,again=false,last='',revision=0;
 let input=null,session='',sequence=0,latest='',active=false,submitting=false,focusNext=false;
 const originals=new WeakMap();
 function restore(){if(input&&originals.has(input)){const old=originals.get(input);input.classList.remove('ios-native-text-input');for(const [key,value] of Object.entries(old)){if(value===null)input.removeAttribute(key);else input.setAttribute(key,value)}originals.delete(input)}active=false}
 function visible(el){
  if(!el||document.hidden||document.querySelector('dialog[open]')||window.MorzsaRealtime?.running())return false;
  for(let node=el;node;node=node.parentElement){const style=getComputedStyle(node);if(node.hidden||style.display==='none'||style.visibility!=='visible')return false}
  // The fixed composer can briefly sit outside the resized visual viewport
  // during keyboard animation. Its logical visibility must keep focus intact.
  const r=el.getBoundingClientRect();return r.width>40&&r.height>20;
 }
 function current(){
  const el=document.getElementById('companion-input'),key=window.MorzsaCompanion?.composerContext?.()||'';
  if(input!==el){restore();resize.disconnect();input=el;last='';if(input)resize.observe(input)}
  if(session!==key){restore();session=key;sequence=0;latest=input?.value||'';last=''}
  const show=!!key&&visible(input);
  if(!show)return {visible:false,session,viewportWidth:innerWidth};
  const rect=input.getBoundingClientRect();
  return {visible:true,session,viewportWidth:innerWidth,x:rect.x,y:rect.y,width:rect.width,height:rect.height,text:input.value,editAck:sequence,placeholder:input.placeholder,label:input.getAttribute('aria-label')||'',dismissLabel:document.documentElement.lang==='en'?'Done':'Kész',maxLength:input.maxLength,editable:!input.disabled&&!input.readOnly,focus:focusNext||document.activeElement===input};
 }
 function acknowledge(){
  if(!input?.isConnected)return;
  if(!originals.has(input))originals.set(input,{'aria-hidden':input.getAttribute('aria-hidden'),tabindex:input.getAttribute('tabindex')});
  input.classList.add('ios-native-text-input');input.setAttribute('aria-hidden','true');input.setAttribute('tabindex','-1');active=true;
 }
 function fallback(){failed=true;restore();plugin.setComposer({visible:false,session,revision:++revision,viewportWidth:innerWidth}).catch(()=>{})}
 async function update(){
  frame=0;if(disposed||failed)return;if(inFlight){again=true;return}
  const state=current(),target=input,key=JSON.stringify(state);if(key===last)return;
  inFlight=true;const rev=++revision;
  try{
   // Release WebKit's input focus before UIKit takes over. Blurring after the
   // acknowledgment can dismiss the keyboard that UITextView just opened.
   if(state.focus&&document.activeElement===target)target.blur();
   const result=await plugin.setComposer({...state,revision:rev});
   if(disposed)return;
   if(result.revision!==rev||result.kind!=='UITextView')throw Error('Native text input unavailable');
   // A render can replace the DOM node while UIKit acknowledges its geometry.
   // Only transfer accessibility/focus for the exact node and chat we sent.
   if(target!==document.getElementById('companion-input')||state.session!==(window.MorzsaCompanion?.composerContext?.()||'')){last='';again=true;return}
   last=key;focusNext=false;
   if(state.visible&&state.session===session&&visible(input))acknowledge();else restore();
  }catch{if(!disposed)fallback()}
  finally{inFlight=false;if(again){again=false;schedule()}}
 }
 function schedule(){if(!frame&&!disposed&&!failed)frame=requestAnimationFrame(update)}
 function write(text,height){
  if(!input?.isConnected)return;
  input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));
  if(Number.isFinite(height))input.style.height=Math.max(44,Math.min(110,height))+'px';
 }
 function changed(event){
  const data=event.detail||event;
  // Native callbacks can arrive between a DOM redraw and the next animation frame.
  current();
  if(disposed||failed||data.session!==session||!Number.isInteger(data.sequence)||data.sequence<sequence||typeof data.text!=='string')return;
  sequence=data.sequence;latest=data.text;write(latest,data.height);schedule();
 }
 async function submit(event){
  const form=event.target;
  if(!active||form.id!=='companion-form'||event.submitter?.dataset.action==='stop')return;
  event.preventDefault();event.stopImmediatePropagation();if(submitting)return;
  const key=session,handler=form.onsubmit,button=event.submitter||form.querySelector('[type=submit]');
  if(!handler||button?.disabled)return;
  submitting=true;
  try{
   // Capture and clear atomically on UIKit's main thread, so subsequent typing
   // starts the next draft even while this bridge response is in flight.
   const value=await plugin.submitComposer({session:key});
   if(disposed)return;
   current();
   if(key!==session||value.session!==key)return;
   // Persistence or streaming may redraw the form during the native round trip.
   const liveForm=input?.closest('#companion-form'),liveButton=liveForm?.querySelector('[type=submit]');
   if(!liveForm?.onsubmit)return;
   const newer=sequence>value.sequence?latest:null;
   sequence=Math.max(sequence,value.sequence);latest=newer||'';
   write(value.text);
   liveForm.onsubmit({preventDefault(){},submitter:liveButton});
   current();if(newer!==null)write(newer);
   last='';schedule();
  }catch{if(!disposed){fallback();input?.focus()}}
  finally{submitting=false}
 }
 function focus(event){if(event.target.id==='companion-input'&&!failed){focusNext=true;event.target.blur();last='';schedule()}}
 function dismissOutside(event){
  if(!active||failed||typeof plugin.dismissComposer!=='function'||event.target.closest?.('#companion-form,button,a,input,textarea,select,summary,label,dialog'))return;
  focusNext=false;input?.blur();plugin.dismissComposer({session}).catch(()=>{});
 }
 function onInput(event){if(event.target.id==='companion-input')schedule()}
 function resume(){failed=false;last='';schedule()}
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','style']});
 const resize=new ResizeObserver(schedule);
 window.addEventListener('morzsa-native-text',changed);window.addEventListener('resize',schedule);window.addEventListener('morzsa-resume',resume);
 document.addEventListener('pointerdown',dismissOutside);document.addEventListener('input',onInput);document.addEventListener('focusin',focus);document.addEventListener('submit',submit,true);document.addEventListener('visibilitychange',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 schedule();
 return {refresh:schedule,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();restore();window.removeEventListener('morzsa-native-text',changed);window.removeEventListener('resize',schedule);window.removeEventListener('morzsa-resume',resume);document.removeEventListener('pointerdown',dismissOutside);document.removeEventListener('input',onInput);document.removeEventListener('focusin',focus);document.removeEventListener('submit',submit,true);document.removeEventListener('visibilitychange',schedule);window.visualViewport?.removeEventListener('resize',schedule);plugin.setComposer({visible:false,session,revision:++revision,viewportWidth:innerWidth}).catch(()=>{})}};
}
