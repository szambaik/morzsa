// Direction locking keeps vertical scrolling separate from dismiss gestures.
const PanelGestures=(()=>{
 function intent(dx,dy,axis){const along=axis==='x'?Math.abs(dx):Math.abs(dy),across=axis==='x'?Math.abs(dy):Math.abs(dx);if(Math.max(along,across)<10)return 'wait';return along>across*1.35?'drag':'scroll'}
 function finish(distance,size){return distance>=Math.min(110,Math.max(65,size*.24))}
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function settle(q,axis,distance,close){
  q.classList.remove('is-dragging');const target=close?distance:0;
  const animation=q.animate([{transform:q.style.transform||'none'},{transform:axis==='x'?'translateX('+target+'px)':'translateY('+target+'px)'}],{duration:reduced()?0:180,easing:'ease-out'});
  animation.finished.catch(()=>{}).then(()=>{q.style.transform='';if(close&&q.open)q.close()});
 }
 function bind(element,options){
  let drag=null,suppress=false;
  const point=e=>e.touches?.[0]||e.changedTouches?.[0]||e;
  function start(e){
   if(e.touches?.length>1||e.button>0||options.disabled?.())return;
   const target=e.target;if(!options.edge&&target.closest('button,a,input,textarea,select,[data-close],.companion-quick-add,label'))return;
   const scroll=target.closest('.companion-quick-items');if(scroll?.scrollTop>0)return;
   const p=point(e);drag={x:p.clientX,y:p.clientY,q:options.edge?null:element,locked:false,dx:0,dy:0};
  }
  function move(e){
   if(!drag)return;if(e.touches?.length>1){end(true);return}const p=point(e),dx=p.clientX-drag.x,dy=p.clientY-drag.y,axis=options.axis;
   if(!drag.locked){const decision=intent(dx,dy,axis);if(decision==='wait')return;if(decision==='scroll'||(options.edge&&dx<0)||(axis==='y'&&dy<0)){drag=null;return}drag.locked=true;drag.q=drag.q||options.open();if(!drag.q){drag=null;return}drag.q.classList.add('is-dragging')}
   if(e.cancelable)e.preventDefault();drag.dx=dx;drag.dy=dy;const q=drag.q,w=q.getBoundingClientRect().width;
   q.style.transform=axis==='x'?'translateX('+Math.max(-w,Math.min(0,options.edge?dx-w:dx))+'px)':'translateY('+Math.max(0,dy)+'px)';
  }
  function end(cancelled=false){
   if(!drag)return;const d=drag;drag=null;if(!d.locked)return;suppress=true;setTimeout(()=>suppress=false,400);
   const size=options.axis==='x'?d.q.offsetWidth:d.q.offsetHeight,distance=options.axis==='x'?(options.edge?d.dx:-d.dx):d.dy;
   const close=options.edge?cancelled||!finish(distance,size):!cancelled&&finish(distance,size);
   settle(d.q,options.axis,options.axis==='x'?-size:size,close);
  }
  element.addEventListener('touchstart',start,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',()=>end());document.addEventListener('touchcancel',()=>end(true));
  element.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){start(e);if(drag)element.setPointerCapture(e.pointerId)}});document.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')move(e)});document.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')end()});document.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')end(true)});
  element.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation()}},true);
  if(!options.edge){element.addEventListener('close',()=>{drag=null;element.style.transform='';element.classList.remove('is-dragging')});element.addEventListener('click',e=>{if(e.target!==element||suppress||options.disabled?.())return;const r=element.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)element.close()})}
 }
 return {intent,finish,bind};
})();
if(typeof module!=='undefined')module.exports=PanelGestures;
