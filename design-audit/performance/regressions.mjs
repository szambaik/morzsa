import assert from 'node:assert/strict';
export async function runRegressions(h){
 const {context,fixture,settled,nav,capture,attempt,check,result}=h;
 const x=await context({actor:'c',trace:true}),p=x.p;await p.goto(fixture.origin);await settled(p);await p.waitForTimeout(600);
 await attempt('preflight-immediate-stop-retains-draft-and-retries',async()=>{
  await p.evaluate(()=>MorzsaCompanion.newChat());await settled(p);
  fixture.rules.push({match:'/rpc/',delay:600,remaining:-1});fixture.ai.push({output:{transcript:'Előkészítés',answer:'A megszakított kérdést újraküldtük.',operations:[],recipes:[],clarification:''}});
  const at=fixture.calls.length;await p.locator('#companion-input').fill('Előkészítés');await p.locator('#companion-form button[type=submit]').click();
  assert.equal(await p.locator('.companion-thinking').isVisible(),true);assert.equal(await p.getByRole('button',{name:'Válasz leállítása',exact:true}).isVisible(),true);await capture(p,'preparing-with-stop');
  await p.waitForTimeout(450);await p.getByRole('button',{name:'Válasz leállítása',exact:true}).click();await p.locator('[data-retry]').waitFor({timeout:1500});assert.equal(await p.locator('#companion-input').inputValue(),'Előkészítés');await p.waitForTimeout(1600);
  assert.equal(fixture.calls.slice(at).filter(c=>c.path.endsWith('/voice-command')&&c.method==='POST').length,0);fixture.rules.length=0;
  await p.locator('[data-retry]').click();await p.getByText('A megszakított kérdést újraküldtük.',{exact:true}).waitFor();await settled(p);
  assert.equal(await p.evaluate(()=>document.querySelectorAll('.companion-message.user').length),1);
 });
 await x.close('preflight-regression');
 await fixture.db.exec('reset role');await fixture.db.query("insert into public.household_records(household_id,bucket,key,value) values ('90000000-0000-4000-8000-000000000001','stock','Rizs','2'),('90000000-0000-4000-8000-000000000001','stock','Tej','2') on conflict(household_id,bucket,key) do update set value=excluded.value");
 const a=await context({actor:'a',shared:true,trace:true}),q=a.p;await q.goto(fixture.origin);await settled(q);await nav(q,'pantry');
 await attempt('pending-pantry-save-closes-without-touching-a-new-dialog',async()=>{
  await q.locator('[data-pantry-details="Rizs"]').click();await settled(q);
  // The initial realtime refresh can start after navigation. Wait for it, then
  // hold the actual write until the second dialog is open, independently of CPU speed.
  const endpoint='**/rest/v1/rpc/apply_household_changes';let release;
  const held=new Promise(resolve=>release=resolve),hold=async route=>{await held;await route.continue()};
  await q.route(endpoint,hold);
  try{
   await Promise.all([q.waitForRequest(endpoint),q.locator('#pantry-item-dialog [data-value="1"]').click()]);
   assert.equal(await q.locator('#pantry-item-dialog .close').isEnabled(),true);assert.match(await q.locator('#pantry-item-dialog [role=status]').textContent(),/Mentés/);await capture(q,'closable-pending-pantry');
   await q.locator('#pantry-item-dialog .close').click();await q.locator('[data-pantry-details="Tej"]').click();release();
   await q.waitForFunction(()=>document.querySelector('#toast')?.textContent.startsWith('Rizs · '));
   assert.equal(await q.locator('#pantry-item-dialog').isVisible(),true,'New pantry dialog must remain open');assert.equal(await q.locator('#pantry-detail-title').textContent(),'Tej');await q.locator('#pantry-item-dialog .close').click();
   await q.reload();await settled(q);assert.equal(await q.evaluate(()=>state.stock.Rizs),1);
  }finally{release();await q.unroute(endpoint,hold);await q.evaluate(()=>document.getElementById('pantry-item-dialog')?.close())}
 });
 fixture.rules.length=0;
 await attempt('realtime-burst-refreshes-only-the-invalidated-data',async()=>{
  await nav(q,'overview');await q.waitForTimeout(1200);const at=fixture.calls.length;
  for(let i=0;i<20;i++)for(const {ws,topic} of a.sockets)if(topic?.startsWith('realtime:morzsa:'))ws.send(JSON.stringify({topic,event:'postgres_changes',payload:{data:{table:'household_records'}}}));
  await q.waitForTimeout(1200);const calls=fixture.calls.slice(at).filter(c=>c.path.startsWith('/rest/'));
  result.targetedRealtime=calls;assert.equal(calls.filter(c=>c.path.startsWith('/rest/v1/household_records?')).length,1);assert.equal(calls.filter(c=>c.path.startsWith('/rest/v1/households?')).length,1);assert.equal(calls.length,2);
 });
 await attempt('unchanged-household-does-not-poll-every-eight-seconds',async()=>{
  const at=fixture.calls.length;await q.waitForTimeout(17000);const calls=fixture.calls.slice(at).filter(c=>c.path.startsWith('/rest/'));result.idleRealtime=calls;assert.equal(calls.length,0);
 });
 await a.close('pantry-realtime-regressions');
 check('all-performance-regressions-passed',result.checks.every(c=>c.status==='passed'));
}
