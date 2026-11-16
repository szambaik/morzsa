const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../proactive-model');
const now=Date.parse('2026-11-16T12:00:00Z'),day=M.DAY;
const trip=(ago,names=['Tej'],kind='purchase')=>({date:new Date(now-ago*day).toISOString(),kind,items:names.map(name=>({name}))});
const fresh=()=>({stock:{},cart:[],custom:[],history:[],likes:['keep'],chats:{keep:[]}});
test('proactive suggestions need real observations; no default consumption or expiry claims',()=>{
 assert.deepEqual(M.candidates(fresh(),{now}),[]);
 assert.deepEqual(M.patterns([trip(4),trip(11)],now),[]);
 assert.deepEqual(M.candidates({...fresh(),stock:{Tej:2}},{now}),[]);
});
test('purchase cadence ignores duplicate days, old, future, malformed and non-purchase archives',()=>{
 const observations=[trip(6),trip(13),trip(20),trip(6),trip(2, ['Tej'],'cleared'),trip(-1),trip(200),{date:'bad',items:[{name:'Tej'}]}];
 const [p]=M.patterns(observations,now);assert.equal(p.samples,3);assert.equal(p.days,7);assert.equal(p.confidence,'low');
 assert.equal(M.patterns([trip(1),trip(2),trip(50)],now).length,0);
});
test('cadence is shown around the next purchase and always as uncertain',()=>{
 const s={...fresh(),stock:{Tej:2},history:[trip(6),trip(13),trip(20)]};
 const [p]=M.candidates(s,{now});assert.equal(p.kind,'recurring');assert.equal(p.remaining,1);assert.equal(p.source,'purchases');assert.equal(p.confidence,'low');assert.equal(s.stock.Tej,2);
 assert.equal(M.candidates({...s,history:[trip(0),trip(7),trip(14)]},{now}).length,0);
});
test('reported shortages outrank guesses and pending or bought list entries suppress duplicates',()=>{
 const s={...fresh(),stock:{Tej:1,Vaj:0,Alma:0},cart:[{name:'ALMA',done:true}],history:[trip(6),trip(13),trip(20)]};
 assert.deepEqual(M.candidates(s,{now,reviews:[{name:'Tej',age:30}]}).map(s=>s.kind),['out','low']);
});
test('review age creates a question, not missing stock or an expiry date',()=>{
 const s={...fresh(),stock:{Rizs:2}};const [p]=M.candidates(s,{now,reviews:[{name:'Rizs',unknown:true}]});
 assert.equal(p.kind,'review');assert.equal(p.confidence,'unknown');assert.equal(s.stock.Rizs,2);
});
test('feedback suppresses a product across kinds and returns only after cooldown',()=>{
 const s={...fresh(),stock:{Tej:1}},[p]=M.candidates(s,{now}),f=M.respond({},p,'later',now);
 assert.equal(M.candidates(s,{now:now+2*day,feedback:f}).length,0);
 assert.equal(M.candidates({...s,stock:{Tej:0}},{now:now+2*day,feedback:f}).length,0);
 assert.equal(M.candidates(s,{now:now+4*day,feedback:f}).length,1);
 assert.equal(f[p.id].counts.later,1);
});
test('still-here corrections widen cadence and do not mutate stock',()=>{
 const s={...fresh(),stock:{Tej:2},history:[trip(6),trip(13),trip(20)]},[p]=M.candidates(s,{now});
 const f=M.respond({},p,'still_here',now);assert.equal(f[p.id].corrections,1);assert.ok(f[p.id].until>=now+7*day);
 assert.equal(M.candidates(s,{now:now+4*day,feedback:f}).length,0);
});
test('a recent pantry confirmation pauses purchase guesses for two days',()=>{
 const s={...fresh(),stock:{Tej:2},history:[trip(6),trip(13),trip(20)]};
 assert.equal(M.candidates(s,{now,confirmedAt:()=>now-day}).length,0);
 assert.equal(M.candidates(s,{now,confirmedAt:()=>now-3*day}).length,1);
});
test('approval is additive, idempotent, and preserves quantities, checked state and recipe associations',()=>{
 const s={...fresh(),stock:{Tej:1},cart:[{name:'Tej',done:true,quantity:4,unit:'l',recipeNeeds:['keep']}]};
 const suggestions=[{kind:'low',name:'tej'},{kind:'out',name:'Alma'},{kind:'out',name:'Alma'}];
 const p=M.listPlan(s,suggestions,()=> 'db');assert.deepEqual(p.added,['Alma']);assert.deepEqual(p.next.cart[0],s.cart[0]);assert.equal(p.next.chats,s.chats);assert.equal(p.next.stock,s.stock);
 assert.deepEqual(M.listPlan(p.next,suggestions,()=> 'db').next,p.next);
});
test('recipe ranking distinguishes confirmed, unchecked and absent ingredients',()=>{
 const recipes=[{id:'a',title:'A',ingredients:[{name:'Tej'},{name:'Tojás'},{name:'Vaj'}],minutes:20,servings:2}];
 const [r]=M.rankRecipes(recipes,{stock:{Tej:2,Tojás:1},uncertain:['Tojás'],now});
 assert.deepEqual(r.home,['Tej']);assert.deepEqual(r.check,['Tojás']);assert.deepEqual(r.missing,['Vaj']);assert.equal(r.total,3);assert.equal(r.servings,2);
});
test('recipe preferences, repeats, favourites and dismissed recommendations affect rank',()=>{
 const recipes=['a','b','c'].map(id=>({id,title:id,ingredients:[{name:'Tej'}],minutes:20}));
 const opts={stock:{Tej:2},favourites:['b'],recent:['a'],accepts:r=>r.id!=='c',now};
 const rows=M.rankRecipes(recipes,opts);assert.deepEqual(rows.map(r=>r.recipeId),['b','a']);
 const feedback=M.respond({},rows[0],'later',now);assert.deepEqual(M.rankRecipes(recipes,{...opts,feedback}).map(r=>r.recipeId),['a']);
});
test('old and malformed feedback is tolerated without changing old save formats',()=>{
 assert.deepEqual(M.cleanFeedback(null),{});assert.deepEqual(M.cleanFeedback({bad:null,also:{until:'x'}}),{});
 const old={stock:{Tej:2},cart:[],likes:['old']};assert.doesNotThrow(()=>M.candidates(old,{now}));assert.deepEqual(old,{stock:{Tej:2},cart:[],likes:['old']});
});
