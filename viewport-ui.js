// Shared viewport owner: native keyboard height is already reflected by innerHeight.
window.MorzsaViewport=(()=>{
 const root=document.documentElement,listeners=new Set(),observed=new Set();
 let frame=0,disposed=false,last={},nativeKeyboard=false;
 const properties=new Map(),set=(name,value)=>{if(properties.get(name)!==value){properties.set(name,value);root.style.setProperty(name,value)}};
 const resize=new ResizeObserver(refresh);
 function update(){
  frame=0;if(disposed)return;
  const v=window.visualViewport,top=v?.offsetTop||0,left=v?.offsetLeft||0,height=v?.height||innerHeight,width=v?.width||innerWidth;
  const inset=Math.max(0,innerHeight-height-top),editing=!!document.activeElement?.matches('textarea,input:not([type=checkbox]):not([type=radio]),select');
  const keyboard=nativeKeyboard||editing&&(v?.scale||1)<1.1&&inset>100;
  root.classList.toggle('keyboard-open',keyboard);
  const nav=document.querySelector('.app>nav'),native=root.classList.contains('native-tabbar');
  const navHeight=keyboard?0:native?parseFloat(getComputedStyle(root).getPropertyValue('--native-tabbar-height'))||0:nav?.getBoundingClientRect().height||0;
  const docks=[...document.querySelectorAll('.companion-compose-wrap,.room-compose-wrap,#workspace-assistant,.cooking-task-dock,#workspace-quick-add.workspace-add-fab')];
  const elements=[nav,...docks].filter(Boolean);
  for(const el of observed)if(!elements.includes(el)){resize.unobserve(el);observed.delete(el)}
  for(const el of elements)if(!observed.has(el)){resize.observe(el);observed.add(el)}
  const visible=el=>{const s=getComputedStyle(el);return !el.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&el.getBoundingClientRect().height>0};
  const task=docks.find(el=>el.matches('.cooking-task-dock')&&visible(el)),taskHeight=task?.getBoundingClientRect().height||0;
  const composer=docks.find(el=>el.matches('.companion-compose-wrap,.room-compose-wrap')&&visible(el)),composeHeight=composer?.getBoundingClientRect().height||0;
  const question=document.body.classList.contains('cooking-question-open');
  const bottom=keyboard?inset:navHeight,composeBottom=bottom+(question?taskHeight:0)+8;
  let reserve=Math.max(navHeight+16,composeHeight?composeBottom+composeHeight+16:0,taskHeight+bottom+16);
  for(const dock of docks.filter(el=>el!==composer&&el!==task&&visible(el))){const r=dock.getBoundingClientRect();reserve=Math.max(reserve,innerHeight-r.top+16)}
  const values={'--viewport-top':top,'--viewport-left':left,'--viewport-height':height,'--viewport-width':width,'--keyboard-inset':keyboard?inset:0,'--workspace-nav-height':navHeight,'--shell-bottom':bottom,'--composer-bottom':composeBottom,'--composer-height':composeHeight,'--task-dock-height':taskHeight,'--shell-content-bottom':reserve};
  for(const [name,value]of Object.entries(values))set(name,Math.round(value*2)/2+'px');
  const next={top,left,height,width,keyboard};
  if(Object.keys(next).some(k=>next[k]!==last[k])){last=next;for(const listener of listeners)listener(next)}
 }
 function refresh(){if(!frame&&!disposed)frame=requestAnimationFrame(update)}
 const focus=()=>refresh(),nativeEvent=e=>{nativeKeyboard=e.detail.open;refresh()};
 const vv=window.visualViewport;
 vv?.addEventListener('resize',refresh);vv?.addEventListener('scroll',refresh);window.addEventListener('resize',refresh);
 document.addEventListener('focusin',focus);document.addEventListener('focusout',focus);window.addEventListener('morzsa-keyboard',nativeEvent);
 const classes=new MutationObserver(refresh);classes.observe(root,{attributes:true,attributeFilter:['class']});classes.observe(document.body,{attributes:true,attributeFilter:['class']});
 refresh();
 return {refresh,subscribe(fn){listeners.add(fn);if(last.height)fn(last);refresh();return()=>listeners.delete(fn)},dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();classes.disconnect();listeners.clear();vv?.removeEventListener('resize',refresh);vv?.removeEventListener('scroll',refresh);window.removeEventListener('resize',refresh);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',focus);window.removeEventListener('morzsa-keyboard',nativeEvent)}};
})();
