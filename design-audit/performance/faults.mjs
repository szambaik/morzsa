import assert from 'node:assert/strict';
export async function runFaults(h){
 const {context,fixture,settled,capture,attempt,check,result,write,log}=h;
 const x=await context({actor:'a',shared:true,trace:true}),p=x.p;await p.goto(fixture.origin);await settled(p);await p.evaluate(()=>AIMode.set('free'));
 const output=(answer,operations=[])=>({transcript:'Audit',answer,operations,recipes:[],clarification:''});
 const ask=async(text,plan)=>{await p.evaluate(()=>MorzsaCompanion.newChat());await settled(p);fixture.ai.push(plan);await p.locator('#companion-input').fill(text);await p.locator('#companion-form button[type=submit]').click()};
 await attempt('AI-long-message-action-confirmation-persistence',async()=>{
  const text='Kérlek tedd a borsot a listára. '+'Ez egy szintetikus, hosszabb kontextus. '.repeat(35);const before=fixture.calls.length;
  await ask(text,{output:output('Borsot javaslok a listára.',[{action:'list_set',name:'Bors',quantity:1,unit:'csomag'}])});await p.locator('[data-companion-apply]').waitFor({timeout:12000});assert.equal(await p.evaluate(()=>state.cart.some(i=>i.name==='Bors')),false);await capture(p,'ai-action-preview');
  await p.locator('[data-companion-apply]').click();await p.waitForFunction(()=>state.cart.some(i=>i.name==='Bors')&&!household.busy&&!household.cartPending,{},{timeout:12000});await p.reload();await settled(p);assert.ok(await p.evaluate(()=>state.cart.some(i=>i.name==='Bors')));result.aiAction={inputCharacters:text.length,calls:fixture.calls.slice(before)};await capture(p,'ai-action-persisted');
 });
 await attempt('AI-truncated-stream-recovers',async()=>{
  await ask('Szakítsd meg a tesztfolyamot.',{stream:['Félbemaradt ','Félbemaradt válasz.'],interval:300,truncate:true,output:output('Nem érhet célba.')});await p.locator('[data-retry]').waitFor({timeout:12000});assert.ok(await p.locator('#companion-input').isEnabled());await capture(p,'ai-stream-interrupted');
 });
 await attempt('AI-real-client-60-second-timeout-recovers',async()=>{
  log('Testing actual 60 second client deadline against local delayed endpoint.');const start=performance.now();await ask('Időtúllépés teszt.',{delay:65000,output:output('Elkésett válasz.')});await p.locator('[data-retry]').waitFor({timeout:64000});result.actualClientTimeoutMs=performance.now()-start;assert.ok(await p.locator('#companion-input').isEnabled());await capture(p,'ai-timeout-recovered');
 });
 await x.close('faults');
}
