const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const recipe={recipeId:'10000000-0000-4000-8000-000000000001',title:'Palacsintabatyu',summary:'Finom',minutes:45,ingredients:[{name:'Liszt',amount:'100 g'}],steps:['Keverd össze.']};
const ready={status:'ready',url:'https://cloud/storage/v1/object/public/recipe-catalog/cover.jpg',expiresAt:Date.now()+60000};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(reply){
 const inputs=[],timers=[],listeners={},observers=[];
 const host=()=>({isConnected:true,children:[],dataset:{},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)},getBoundingClientRect(){return {top:100,bottom:300,left:0,right:300,width:300,height:200}}});
 const context={window:{MORZSA_CLOUD:{url:'https://cloud'},addEventListener:(name,fn)=>listeners[name]=fn},innerHeight:844,innerWidth:390,household:{active:null,userId:()=> 'test',recipeImage:async input=>{inputs.push(input);return reply(input)}},language:'hu',document:{hidden:false,addEventListener:(name,fn)=>listeners[name]=fn,createElement:tag=>({tag,setAttribute(){}})},IntersectionObserver:class{constructor(cb){observers.push(cb)}observe(){}disconnect(){}},setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer},clearTimeout:timer=>{if(timer)timer.cancelled=true}};
 vm.runInNewContext(fs.readFileSync('recipe-images.js','utf8'),context);
 const mount=(r=recipe)=>{const node=host();context.window.RecipeImages.mount(node,r,-1,{autoCreate:true,quiet:true});observers.at(-1)([{isIntersecting:true}]);return node};
 return {inputs,timers,listeners,context,mount};
}
test('returning to a pending card retrieves its completed image without another generation',async()=>{
 let completed=false;const f=fixture(()=>completed?ready:{status:'pending'}),first=f.mount();await flush();
 first.isConnected=false;await f.timers[0].fn();await flush();completed=true;
 const returned=f.mount();await flush();
 assert.equal(returned.dataset.imageStatus,'ready');assert.deepEqual(f.inputs.map(i=>i.create),[false,false]);
});
test('native resume recovers a failed quiet card from the backend cache',async()=>{
 let completed=false;const f=fixture(()=>{if(!completed)throw Error('IMAGE_TIMEOUT');return ready}),card=f.mount();await flush();
 assert.equal(card.dataset.imageStatus,'failed');assert.ok(card.children.some(n=>n.tag==='button'),'failed card has a reachable retry');
 completed=true;f.listeners['morzsa-resume']();await flush();
 assert.equal(card.dataset.imageStatus,'ready');assert.deepEqual(f.inputs.map(i=>i.create),[false,false]);
});
test('quiet card image decode failure recovers with a cache read and ignores detached callbacks',async()=>{
 const f=fixture(()=>ready),card=f.mount();await flush();const oldImage=card.children[0];oldImage.onerror();await flush();
 assert.equal(card.dataset.imageStatus,'failed');assert.ok(card.children.some(n=>n.tag==='button'));
 const timer=f.timers.find(t=>!t.cancelled);assert.ok(timer);await timer.fn();await flush();
 assert.equal(card.dataset.imageStatus,'ready');assert.deepEqual(f.inputs.map(i=>i.create),[false,false]);
 oldImage.onerror();await flush();assert.equal(card.dataset.imageStatus,'ready');
});
test('a cached cover is not blocked behind another card generating an image',async()=>{
 let release;const f=fixture(input=>input.recipe.title==='Slow'?(input.create?new Promise(resolve=>release=resolve):{status:'missing'}):ready);
 const slow=f.mount({...recipe,title:'Slow'});await flush();assert.equal(slow.dataset.imageStatus,'loading');
 const cached=f.mount();await flush();assert.equal(cached.dataset.imageStatus,'ready');
 assert.deepEqual(f.inputs.map(i=>i.create),[false,true,false]);release(ready);await flush();
});
test('resume does not create duplicate polls and ignores the cancelled pre-suspension timer',async()=>{
 const f=fixture(()=>({status:'pending'}));f.mount();await flush();const previous=f.timers[0];
 f.listeners['morzsa-resume']();f.listeners.online();await flush();
 await previous.fn();await flush();assert.equal(f.inputs.length,2);assert.equal(f.inputs.every(i=>i.create===false),true);
});
test('automatic failed-card recovery is bounded and skips offscreen cards',async()=>{
 const f=fixture(()=>{throw Error('IMAGE_TIMEOUT')}),card=f.mount();await flush();
 for(let i=0;i<2;i++){await f.timers[i].fn();await flush()}
 assert.equal(f.inputs.length,3);assert.equal(f.timers.length,2);assert.equal(f.inputs.every(i=>i.create===false),true);
 card.getBoundingClientRect=()=>({top:1500,bottom:1700,left:0,right:300,width:300,height:200});
 f.listeners['morzsa-resume']();await flush();assert.equal(f.inputs.length,3);
});
