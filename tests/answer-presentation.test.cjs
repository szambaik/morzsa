const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function presentation(reduced=false){
 let now=0,id=0;const frames=new Map(),stream={textContent:''},answer={textContent:'',classList:{remove(){}},closest:()=>({set outerHTML(text){answer.final=text}})};
 const context={window:{scrollTo(){}},main:{querySelector:s=>s==='[data-stream-answer]'?stream:s==='[data-answer-reveal]'?answer:{toggleAttribute(){}}},document:{hidden:false,documentElement:{scrollHeight:900},querySelector:()=>null},CompanionModel:{},language:'hu',page:'chat',scrollY:0,innerHeight:600,performance:{now:()=>now},matchMedia:()=>({matches:reduced}),ChatFormat:{render:text=>text},esc:text=>text,requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:n=>frames.delete(n)};
 const source=fs.readFileSync('companion-ui.js','utf8').split(' const safeRead=')[0];
 vm.runInNewContext(source+`
 context='test';book={active:'one',threads:[{id:'one',messages:[]}]};
 window.qa={feed:text=>{streamText=text;paintStream()},finish:text=>{thread().messages=[{role:'model',text}];startReveal(streamVisible);resetStream();if(reveal)answerText(thread().messages[0],0);animateAnswer()},reset:resetStream,state:()=>({streamVisible,revealCount:reveal?.count,answer:reveal?.parts.slice(0,reveal.count).join('')})};
})();`,context);
 return {qa:context.window.qa,stream,answer,frame(){now+=16;const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(now))},pending:()=>frames.size};
}
test('a burst of network chunks remains progressive across stream completion',()=>{
 const p=presentation(),text='Morzsa lassan kiírja ezt a választ, akkor is ha egy nagy csomagban érkezik.';
 p.qa.feed(text.slice(0,10));p.qa.feed(text);assert.equal(p.pending(),1);p.frame();const shown=p.stream.textContent;assert.ok(shown.length>0&&shown.length<text.length);
 p.qa.finish(text);assert.equal(p.qa.state().answer,shown);p.frame();assert.ok(p.qa.state().answer.length<text.length);
 for(let i=0;i<500&&p.pending();i++)p.frame();assert.equal(p.answer.final,text);assert.equal(p.pending(),0);
});
test('a buffered JSON response also reveals progressively and cancellation clears scheduled text',()=>{
 const p=presentation();p.qa.finish('Egy teljes, nem streamelt válasz.');p.frame();assert.ok(p.qa.state().answer.length<30);
 p.qa.feed('A megállított válasz');p.qa.reset();assert.equal(p.qa.state().streamVisible,'');
});
test('reduced motion preference shows the answer immediately without replay',()=>{
 const p=presentation(true),text='A teljes válasz.';p.qa.feed(text);p.frame();assert.equal(p.stream.textContent,text);p.qa.finish(text);assert.equal(p.pending(),0);
});
test('streamed emoji never expose an incomplete surrogate pair',()=>{
 const p=presentation(),text='🍰🍳🥛🧁 Finom desszert';p.qa.feed(text);
 for(let i=0;i<100&&p.pending();i++){p.frame();assert.ok(!/[\uD800-\uDBFF]$/.test(p.stream.textContent))}
 assert.equal(p.stream.textContent,text);
});
