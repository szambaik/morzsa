import {chromium,webkit} from '../design-audit/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const engine=process.env.MORZSA_IMAGE_BROWSER||'chromium',base=process.env.MORZSA_QA_BASE||'http://127.0.0.1:8942',out=process.env.MORZSA_QA_OUT||'/tmp/morzsa-calm-chat';
fs.mkdirSync(out,{recursive:true});
const browser=await ({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{channel:process.env.MORZSA_AUDIT_BROWSER_CHANNEL||'chrome'}:{})});
const context=await browser.newContext({viewport:{width:430,height:844},hasTouch:true}),p=await context.newPage(),errors=[];
p.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
try{
 await p.goto(base+'/?actor=c');await p.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy);
 await p.addStyleTag({url:base+'/mobile/ios.css'});await p.evaluate(()=>document.documentElement.classList.add('native-ios'));
 await p.evaluate(async()=>{Object.assign(state.stock,{'Borsó':0,'Rizs':2,'Tojás':2});const r=await RecipeLibrary.get('10000000-0000-4000-8000-000000000001');MorzsaCompanion.discuss(r);await MorzsaPersistence.flush();MorzsaCompanion.newChat()});
 await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');
 await p.locator('.cooking-resume-card').waitFor();
 assert.equal(await p.locator('.proactive-chat .proactive-actions>button').count(),1);
 assert.equal(await p.locator('.cooking-resume-card [data-more-cooking]').count(),0);
 const widths=[320,360,390,430,1366];
 for(const width of widths){
  await p.setViewportSize({width,height:844});await p.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
  const geometry=await p.evaluate(()=>{
   const box=s=>document.querySelector(s).getBoundingClientRect(),form=box('#companion-form'),photo=box('[data-photo]'),text=box('#companion-input'),mic=box('[data-mic]'),send=box('#companion-form [type=submit]'),fresh=box('#workspace-new-chat');
   return {single:form.height<65,order:photo.right<=text.left&&text.right<=mic.left&&mic.right<=send.left,touch:[photo,mic,send,fresh].every(r=>r.width>=44&&r.height>=44),top:fresh.top<90&&fresh.right>innerWidth-100};
  });
  assert.deepEqual(geometry,{single:true,order:true,touch:true,top:true},'controls '+width);
  await p.screenshot({path:out+'/'+engine+'-chat-'+width+'.png'});
 }
 await p.setViewportSize({width:430,height:844});
 await p.locator('#companion-input').fill('Első sor\nMásodik sor\nHarmadik sor');
 assert.equal(await p.locator('#companion-form').evaluate(el=>el.getBoundingClientRect().height>65),true);
 await p.locator('#companion-input').fill('');await p.locator('#companion-input').blur();
 await p.locator('.companion-header-history').click();
 const history=p.locator('#companion-history');await history.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
 assert.equal(await history.locator('[data-history-search]').isHidden(),true);
 assert.equal(await history.locator('.workspace-preferences').isHidden(),true);
 assert.equal(await history.locator('[data-archive]').isHidden(),true);
 await p.screenshot({path:out+'/'+engine+'-history-430.png'});
 await history.locator('[data-history-toggle-search]').click();await history.locator('[data-history-search]').fill('palacsinta');
 assert.ok(await history.locator('.history-thread:visible').count()>0);
 await p.evaluate(()=>MorzsaCompanion.openHistory());
 assert.equal(await history.locator('[data-history-search]').inputValue(),'palacsinta');
 await history.locator('[data-history-toggle-search]').click();
 await history.locator('.history-options>summary').click();assert.equal(await history.locator('[data-archive]').isVisible(),true);
 await history.locator('.history-options>summary').click();
 await history.locator('.workspace-settings>summary').click();
 assert.equal(await history.locator('.workspace-preferences').isVisible(),true);assert.equal(await history.locator('.workspace-introduction').isVisible(),true);
 await history.locator('.workspace-preferences').click();await p.locator('#kitchen-preferences[open]').waitFor();
 assert.equal(await p.locator('dialog[open]').count(),1);
 await p.locator('#kitchen-preferences .close').click();
 await p.locator('#workspace-new-chat').click();await p.locator('#companion-input').fill('Szia');await p.locator('#companion-form [type=submit]').click();await p.locator('.companion-message.model').filter({hasText:'Tesztválasz'}).waitFor();
 assert.equal(await p.locator('.proactive-chat').count(),0,'conversation is not interrupted by startup recommendations');
 await p.locator('#companion-input').blur();await p.screenshot({path:out+'/'+engine+'-conversation-430.png'});
 // Exercise the moved archive control, including the existing guarded Undo.
 await p.locator('.companion-header-history').click();
 await history.locator('.history-options>summary').click();
 await history.locator('[data-archive]').click();
 await p.locator('#history-undo button').click();
 await p.locator('.companion-header-history').click();
 if(!await history.locator('.history-options').evaluate(e=>e.open))await history.locator('.history-options>summary').click();
 assert.match(await history.locator('[data-archive]').innerText(),/archiválása/);
 await history.locator('[data-close]').click();
 // Separate household members with the same isolated backend. No real data or AI calls.
 const members=[];
 try{
  const settled=q=>q.waitForFunction(()=>MorzsaPersistence.status()==='synced'&&!household.busy&&!document.querySelector('.companion-thinking'));
  const member=async actor=>{
   const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});members.push(c);
   await c.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
   const q=await c.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(base+'/?actor='+actor);await settled(q);return q;
  };
  const a=await member('a'),b=await member('b');
  await a.locator('#workspace-new-chat').click();await a.locator('#companion-input').fill('Közös próba '+Date.now());await a.locator('#companion-form [type=submit]').click();await a.locator('.companion-message.model').filter({hasText:'Tesztválasz'}).waitFor();await settled(a);
  const id=await a.evaluate(()=>JSON.parse(localStorage.getItem(PersistenceModel.accountKey(household.userId()))).active);
  const indexed=q=>q.evaluate(async id=>(await household.dataRpc('conversation_index',{},true)).some(t=>t.id===id),id);
  assert.equal(await indexed(b),false,'private by default');
  const privacy=async q=>{
   await q.locator('.companion-header-history').click();const h=q.locator('#companion-history');
   if(!await h.locator('.history-options').evaluate(e=>e.open))await h.locator('.history-options>summary').click();
   if(!await h.locator('.history-sharing').evaluate(e=>e.open))await h.locator('.history-sharing>summary').click();return h;
  };
  let h=await privacy(a);assert.match(await h.innerText(),/Csak te látod/);
  await h.locator('[data-share-chat]').click();await h.locator('[data-confirm-share]').click();await h.locator('[data-confirm-share]').waitFor({state:'detached'});
  assert.equal(await indexed(b),true,'shared conversation appears to household member');
  await a.waitForLoadState('networkidle');await a.reload();await settled(a);await a.evaluate(id=>MorzsaCompanion.openThread(id),id);h=await privacy(a);assert.match(await h.innerText(),/Megosztva: QA kitchen/);
  await b.evaluate(()=>MorzsaPersistence.refresh());await settled(b);await b.evaluate(id=>MorzsaCompanion.openThread(id),id);await b.locator('.companion-header-history').click();
  const bh=b.locator('#companion-history');await bh.locator('.history-options>summary').click();assert.match(await bh.innerText(),/Megosztva veled · csak olvasható/);assert.equal(await bh.locator('[data-share-chat]').count(),0);
  assert.equal(await bh.locator('[data-archive]').isEnabled(),true,'member can archive their shared view');
  await h.locator('[data-share-chat]').click();await h.locator('[data-confirm-share]').click();await h.locator('[data-confirm-share]').waitFor({state:'detached'});
  assert.equal(await indexed(b),false,'revocation removes member access');
  await Promise.all([a,b].map(q=>q.waitForLoadState('networkidle')));
 }finally{for(const c of members)await c.close()}
 assert.deepEqual(errors,[]);const result={engine,widths,singleRow:true,headerNewChat:true,oneSuggestionAction:true,searchPreserved:true,managementAccessible:true,archiveUndo:true,privateShareRevoke:true,send:true,errors};
 fs.writeFileSync(out+'/'+engine+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await context.close();await browser.close()}
