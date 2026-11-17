// UIKit is opt-in for navigation and the three chat starters only.
// Pantry, shopping, settings and recipe actions keep their original web layout.
// DOM actions remain the single source of business behavior and authorization.
export function installIOSControls(plugin){
 if(typeof plugin.setControls!=='function')return {dispose(){}};
 const ids=new WeakMap(),mirrored=new Map();let next=0,frame=0,flight=false,again=false,failed=false,disposed=false,last='',revision=0,scrollTimer;
 const symbols={'square-pen':'square.and.pencil','message-circle':'bubble.left','shopping-cart':'cart','plus':'plus','check':'checkmark','x':'xmark','heart':'heart','arrow-right':'arrow.right','arrow-left':'arrow.left','chef-hat':'fork.knife','sliders-horizontal':'slider.horizontal.3','sparkles':'sparkles','mic':'mic','home':'house','house':'house','layout-grid':'square.grid.2x2','search':'magnifyingglass','trash-2':'trash','chevron-left':'chevron.left','chevron-right':'chevron.right','clock':'clock','volume-2':'speaker.wave.2','pause':'pause','play':'play','download':'square.and.arrow.down','share-2':'square.and.arrow.up'};
 const special=[['#workspace-new-chat,[data-new-chat]','square.and.pencil'],['[data-history],.companion-header-history','sidebar.left'],['#companion-history .companion-panel-head [data-close]','xmark'],['.companion-back-main[data-main],.recipe-reading-back[data-reading-back]','arrow.left']];
 const allowed=special.map(([selector])=>selector).concat(['.companion-starters [data-prompt="surprise"]','.companion-starters [data-open-craft]','.companion-starters [data-prompt="familiar"]']).join(',');
 function restore(el,old){el.classList.remove('ios-native-control');for(const [key,value] of Object.entries(old)){if(value===null)el.removeAttribute(key);else el.setAttribute(key,value)}}
 function clear(){for(const [el,old] of mirrored)restore(el,old);mirrored.clear()}
 function visible(el){
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  if(!el.isConnected||el.closest('[hidden],[inert],dialog:not([open])')||s.display==='none'||s.visibility!=='visible'||r.width<32||r.height<32||r.top<0||r.left<0||r.bottom>innerHeight||r.right>innerWidth)return false;
  // Closed details can still report descendant geometry in WebKit. Native
  // overlays must follow actual disclosure/ancestor visibility, not geometry alone.
  for(let parent=el.parentElement;parent;parent=parent.parentElement){
   const style=getComputedStyle(parent);
   if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0)return false;
   if(parent.matches('details:not([open])')&&!parent.querySelector(':scope > summary')?.contains(el))return false;
  }
  return true;
 }
 function snapshot(){
  const buttons=[],elements=new Map(),modal=[...document.querySelectorAll('dialog[open]')].at(-1);
  for(const el of (modal||document).querySelectorAll(allowed)){
   // File selection, login/popups, audio start and permission prompts need the
   // browser's trusted activation. Rich cards are content, not toolbar buttons.
   if(el.closest('nav,.workspace-navigation')||el.matches('[data-photo],[data-workspace-photo],[data-mic],[data-workspace-mic],[data-cooking-voice],[data-login],#household-button')||el.querySelector('h1,h2,h3,strong,small,input,textarea')||!visible(el))continue;
   const text=el.textContent.trim(),label=el.getAttribute('aria-label')||el.title||text;
   if(!label||label.length>180||text.length>65)continue;
   let symbol=special.find(([selector])=>el.matches(selector))?.[1];
   if(!symbol){const image=el.querySelector('img[src*="/ui/"]')?.getAttribute('src')?.split('/').at(-1)?.replace('.svg','');symbol=symbols[image]}
   if(!symbol&&text==='×')symbol='xmark';
   if(!symbol&&!text)continue;
   let fixed=false;for(let parent=el;parent;parent=parent.parentElement)if(['fixed','sticky'].includes(getComputedStyle(parent).position)){fixed=true;break}
   if(!ids.has(el))ids.set(el,String(++next));const id=ids.get(el),r=el.getBoundingClientRect();
   const selected=el.getAttribute('aria-pressed')==='true'||el.getAttribute('aria-selected')==='true';
   buttons.push({id,x:Math.round(r.x*2)/2,y:Math.round(r.y*2)/2,width:r.width,height:r.height,fixed,label,title:symbol&&(!/[\p{L}\p{N}]/u.test(text)||el.matches('[type=submit],.companion-header-history'))?'':text,fontSize:parseFloat(getComputedStyle(el).fontSize)||14,stacked:el.matches('.companion-starters button')&&getComputedStyle(el).flexDirection==='column',symbol:symbol||'',disabled:el.disabled,selected,prominent:el.matches('.primary,[type=submit],.cooking-complete,.recipe-chat-cook,[data-start-shopping]'),destructive:el.matches('[data-end],[data-voice-end]')});elements.set(id,el);
   if(buttons.length>=80)break;
  }
  return {buttons,elements};
 }
 function acknowledge(elements){
  for(const [el,old] of mirrored)if(![...elements.values()].includes(el)){restore(el,old);mirrored.delete(el)}
  for(const el of elements.values())if(el.isConnected&&!mirrored.has(el)){mirrored.set(el,{'aria-hidden':el.getAttribute('aria-hidden'),tabindex:el.getAttribute('tabindex')});el.classList.add('ios-native-control');el.setAttribute('aria-hidden','true');el.setAttribute('tabindex','-1')}
 }
 async function update(){
  frame=0;if(disposed||failed)return;if(flight){again=true;return}
  const {buttons,elements}=snapshot(),key=JSON.stringify(buttons);if(key===last)return;
  flight=true;const rev=++revision;
  try{const result=await plugin.setControls({revision:rev,viewportWidth:innerWidth,buttons});if(disposed)return;if(result.revision!==rev)throw Error('Stale native controls');last=key;acknowledge(elements)}
  catch{failed=true;clear();plugin.setControls({revision:++revision,viewportWidth:innerWidth,buttons:[]}).catch(()=>{})}
  finally{flight=false;if(again){again=false;schedule()}}
 }
 function schedule(){if(!frame&&!disposed&&!failed)frame=requestAnimationFrame(update)}
 function activate(event){
  const data=event.detail||event,el=[...mirrored.keys()].find(b=>ids.get(b)===data.id);
  if(disposed||data.revision!==revision||!el||!el.matches(allowed)||el.disabled||!visible(el))return;
  const r=el.getBoundingClientRect();if(Math.abs(r.x-data.x)>3||Math.abs(r.y-data.y)>3)return;
  const modal=[...document.querySelectorAll('dialog[open]')].at(-1);if(modal&&!modal.contains(el))return;
  el.click();schedule();
 }
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&([...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1)||r.target.closest?.('button'))||r.type==='attributes'&&!['aria-hidden','tabindex'].includes(r.attributeName)&&!(r.attributeName==='class'&&r.target.matches?.('button'))))schedule()});
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','style']});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','open','aria-pressed','aria-selected','class']});
 function onScroll(e){
  // Root scrolling is handled by UIScrollView, with native fixed controls tracked
  // in Swift. Nested DOM scroll containers temporarily retain web controls.
  if(e.target!==document&&e.target!==window){clear();last='';plugin.setControls({revision:++revision,viewportWidth:innerWidth,buttons:[]}).catch(()=>{})}
  clearTimeout(scrollTimer);scrollTimer=setTimeout(schedule,120);
 }
 function resume(){failed=false;last='';schedule()}
 window.addEventListener('morzsa-native-action',activate);window.addEventListener('resize',schedule);window.addEventListener('morzsa-resume',resume);document.addEventListener('scroll',onScroll,true);document.addEventListener('input',schedule);
 document.addEventListener('animationend',schedule,true);document.addEventListener('transitionend',schedule,true);
 const resize=new ResizeObserver(schedule);resize.observe(document.body);window.visualViewport?.addEventListener('resize',schedule);
 schedule();return {refresh:schedule,dispose(){disposed=true;clearTimeout(scrollTimer);cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();clear();window.removeEventListener('morzsa-native-action',activate);window.removeEventListener('resize',schedule);window.removeEventListener('morzsa-resume',resume);document.removeEventListener('scroll',onScroll,true);document.removeEventListener('input',schedule);document.removeEventListener('animationend',schedule,true);document.removeEventListener('transitionend',schedule,true);window.visualViewport?.removeEventListener('resize',schedule);plugin.setControls({revision:++revision,viewportWidth:innerWidth,buttons:[]}).catch(()=>{})}};
}
