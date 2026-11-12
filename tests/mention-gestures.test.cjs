const {test}=require('node:test'),assert=require('node:assert/strict'),Gesture=require('../panel-gestures');
test('sheet gestures leave buttons clickable and respect a saving backdrop guard',()=>{
 const previous=global.document;global.document={addEventListener(){}};
 try{
  const handlers={};let captures=0,closed=0;
  const element={addEventListener(type,fn){(handlers[type]??=[]).push(fn)},setPointerCapture(){captures++},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}},close(){closed++}};
  let saving=false;Gesture.bind(element,{axis:'y',disabled:()=>saving});
  const button={closest(selector){return selector.split(',').includes('button')?this:null}};
  handlers.pointerdown[0]({pointerType:'mouse',button:0,target:button,pointerId:1,clientX:20,clientY:20});
  assert.equal(captures,0,'button taps must not be retargeted to the dialog');
  saving=true;handlers.click.at(-1)({target:element,clientX:150,clientY:150});assert.equal(closed,0);
  saving=false;handlers.click.at(-1)({target:element,clientX:150,clientY:150});assert.equal(closed,1);
 }finally{global.document=previous}
});
test('horizontal drags open and dismiss history while vertical scrolling and row taps stay available',async()=>{
 const previousDoc=global.document,previousMedia=global.matchMedia;const docs={};global.document={addEventListener(type,fn){(docs[type]??=[]).push(fn)}};global.matchMedia=()=>({matches:true});
 try{
  let closed=0,opened=0,captures=0;const handlers={},classes=new Set();
  const panel={open:true,offsetWidth:320,offsetHeight:800,style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},getBoundingClientRect:()=>({width:320}),animate:()=>({finished:Promise.resolve()}),close(){this.open=false;closed++},addEventListener(type,fn){(handlers[type]??=[]).push(fn)},setPointerCapture(){captures++}};
  const row={closest:()=>null};Gesture.bind(panel,{axis:'x',edge:true,open:()=>{opened++;return panel}});
  const touch=(x,y)=>({target:row,touches:[{clientX:x,clientY:y}],cancelable:true,preventDefault(){}});
  handlers.touchstart[0](touch(10,100));docs.touchmove[0](touch(12,160));docs.touchend[0]();assert.equal(opened,0);
  handlers.touchstart[0](touch(10,100));docs.touchmove[0](touch(140,103));docs.touchend[0]();await new Promise(resolve=>setImmediate(resolve));assert.equal(opened,1);assert.equal(closed,0);
  const dismiss={};global.document={addEventListener(type,fn){dismiss[type]=fn}};const rows={};panel.addEventListener=(type,fn)=>{rows[type]=fn};Gesture.bind(panel,{axis:'x',allowControls:true});
  const button={closest:()=>({})};rows.pointerdown({pointerType:'mouse',button:0,target:button,pointerId:1,clientX:240,clientY:100});assert.equal(captures,0,'a plain row click must not be captured');
  dismiss.pointermove({pointerType:'mouse',target:button,pointerId:1,clientX:100,clientY:101,cancelable:true,preventDefault(){}});dismiss.pointerup({pointerType:'mouse'});await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,1);
 }finally{global.document=previousDoc;global.matchMedia=previousMedia}
});
