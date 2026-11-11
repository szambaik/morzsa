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
