const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../companion-model'),C=require('../cooking-session'),P=require('../persistence-model'),R=require('../recipe-room-model');
const now=Date.now(),recipe={title:'Palacsinta',summary:'Egyszerű étel.',minutes:25,ingredients:[{name:'Tojás',amount:'2 db'}],steps:['Keverd össze.','Süsd meg.']};
const session=(id,extra={})=>({id,kind:'recipe',title:recipe.title,recipe,status:'active',updated:now,cookingStep:1,completedSteps:[0],messages:[],cooking:{phase:'guided',timers:[],feedback:{notes:'Emlék',householdFavourite:false}},...extra});
test('history derives titles without network work and distinguishes empty from unloaded',()=>{
 assert.equal(M.historyTitle({title:'Új beszélgetés',messages:[{role:'user',text:'Mit főzzek cukkiniből?'}]}),'Mit főzzek cukkiniből?');
 assert.equal(M.historyTitle(session('recipe')),recipe.title);
 assert.match(M.historyTitle({id:'empty',updated:now,messages:[]}),/^Üres beszélgetés · /);
 assert.match(M.historyTitle({id:'remote',cloud:true,revision:1,loaded:false,updated:now,messages:[]}),/^Beszélgetés · /);
 assert.doesNotThrow(()=>M.normalize({threads:[{id:'corrupt',title:{},messages:[null,{role:'user'}]}]},R.recipe));
 assert.equal(M.meaningfulTitle({title:'Saját cím',messages:[{role:'user',text:'Más'}]}),'Saját cím');
});
test('history pages bound DOM input while search reaches loaded rows beyond the first page',()=>{
 const book={threads:Array.from({length:600},(_,i)=>({id:String(i),title:'Vacsora '+i,updated:now-i,messages:[]}))};
 assert.equal(M.historyPage(book).recent.length,30);assert.equal(M.historyPage(book).total,600);
 assert.deepEqual(M.historyPage(book,'Vacsora 599').recent.map(t=>t.id),['599']);
 assert.equal(book.threads.length,600);
});
test('one lifecycle definition excludes completion and counts IDs rather than recipe names',()=>{
 const a=session('a'),b=session('b'),completed=session('c',{cooking:{phase:'completion'}}),paused=session('p',{cooking:{phase:'guided',activity:'paused',activityAt:now}}),stale=session('s',{updated:now-C.staleAfter-1}),prep=session('prep',{cooking:{phase:'preparation'}});
 const group=C.sessions([a,a,b,completed,paused,stale,prep],now);
 assert.equal(group.active.length,2);assert.equal(group.paused.length,2);assert.equal(group.preparation.length,1);assert.equal(group.all.length,5);
 assert.equal(C.lifecycle(completed),'completed');assert.equal(stale.status,'active');
});
test('pause/resume preserves steps, timers, notes and old active/completed contract',()=>{
 const t=session('a');t.cooking=C.addTimer(t,{id:'timer',minutes:5,label:'Sütés'},now);
 t.cooking=C.activity(t,'paused',now+1);assert.equal(C.lifecycle(t,now+2),'paused');
 const stored=P.metadata(t),loaded=M.workspace({threads:[stored&&{...t,...stored}]},R.recipe,now+2).threads.find(x=>x.id==='a');
 assert.equal(loaded.status,'active');assert.equal(C.lifecycle(loaded,now+2),'paused');
 loaded.cooking=C.activity(loaded,'active',now+3);loaded.updated=now+3;
 assert.equal(C.lifecycle(loaded,now+3),'active');assert.equal(loaded.cookingStep,1);assert.deepEqual(loaded.completedSteps,[0]);assert.equal(loaded.cooking.timers.length,1);assert.equal(loaded.cooking.feedback.notes,'Emlék');
});
test('concurrent newer resume wins stale pause; completion still wins every activity change',()=>{
 const t=session('a'),paused=C.activity(t,'paused',now),resumed=C.activity(t,'active',now+1);
 assert.equal(C.merge(resumed,paused).activity,'active');assert.equal(C.merge(paused,resumed).activity,'active');
 const finished=C.finish(t,now+2);assert.equal(C.merge(finished,resumed).phase,'completion');
 assert.equal(C.lifecycle({...t,cooking:C.merge(finished,resumed)}),'completed');
 assert.throws(()=>C.activity({...t,status:'completed'},'active'),/INVALID/);
});
test('a legacy phase-completed session is history and is not reused for another cook',()=>{
 const t=session('a',{cooking:{phase:'completion'}}),book=M.workspace({threads:[t]},R.recipe,now);
 const next=M.startRecipe(book,recipe,'new',R.recipe,now);assert.equal(next.active,'new');assert.equal(next.threads.find(x=>x.id==='a').cooking.phase,'completion');
});
