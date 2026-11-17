// Same signed-in user and conversation, real settings controls and request routing.
export async function verifyAIMode(p,fixture,check,shot){
 let enabled=false,held=null;
 const pattern=fixture.origin+'/functions/v1/plus-assistant*';
 await p.route(pattern,async r=>{
  if(r.request().method()!=='GET')return r.continue();
  const status={configured:true,enabled};
  if(held)await held;
  await r.fulfill({json:status});
 });
 const settings=p.locator('.workspace-settings'),select=p.locator('#workspace-ai-mode'),status=p.locator('#workspace-ai-status');
 const open=async()=>{await p.evaluate(()=>MorzsaCompanion.openHistory());if(!await settings.getAttribute('open').then(x=>x!==null))await settings.locator('summary').first().click()};
 const close=()=>p.locator('#companion-history [data-close]').click();
 const send=async(text,plan)=>{fixture.ai.push(plan);const from=fixture.calls.length;await p.locator('#companion-input').fill(text);await p.locator('#companion-form').evaluate(el=>el.requestSubmit());await p.locator(plan.error?'[data-retry]':'[data-action=send]').waitFor();await p.waitForFunction(()=>MorzsaPersistence.status()==='synced');return fixture.calls.slice(from).filter(c=>c.method==='POST'&&c.path.startsWith('/functions/'))};
 const output={answer:'A módváltás utáni válasz.',transcript:'Segíts a vacsorával.',recipes:[],operations:[],clarification:''};
 await open();await status.filter({hasText:'még nincs hozzáférés'}).waitFor();
 check('Settings distinguish selected Plus from missing access',await select.inputValue()==='plus');await shot('plus-access-required');await close();
 const denied=await send('Segíts a vacsorával.',{error:'PLUS_ACCESS_REQUIRED'});
 check('Denied Plus stays on the Plus route',denied.length===1&&denied[0].path==='/functions/v1/plus-assistant');
 check('Chat explains access instead of claiming Free mode',await p.locator('.companion-error').textContent().then(t=>t.includes('Plus módban vagy')));
 await open();await select.selectOption('free');await status.filter({hasText:'Ingyenes AI-módot'}).waitFor();await close();
 check('Mode change clears the previous access warning',await p.locator('.companion-error').count()===0);
 const free=await send('Most ingyenes módban.',{output});
 check('Free dispatch uses the free endpoint',free.length===1&&free[0].path==='/functions/v1/voice-command');
 enabled=true;await open();await select.selectOption('plus');await status.filter({hasText:'Plus-hozzáférés aktív.'}).waitFor();await shot('plus-access-active');await close();
 const plus=await send('Most Plus módban.',{output});
 check('Free to Plus dispatch switches immediately',plus.length===1&&plus[0].path==='/functions/v1/plus-assistant');
 check('Successful Plus response leaves no stale access warning',await p.locator('.companion-error').count()===0);
 // A slow status response from Plus may not overwrite the next Free selection.
 let release;held=new Promise(r=>release=r);const requested=p.waitForRequest(r=>r.method()==='GET'&&r.url().includes('/plus-assistant'));
 await open();await requested;await select.selectOption('free');release();await p.waitForTimeout(80);
 check('Late Plus status cannot overwrite Free selection',await status.textContent()==='Ingyenes AI-módot használsz.');
 held=null;await select.selectOption('plus');await status.filter({hasText:'Plus-hozzáférés aktív.'}).waitFor();await close();
 await p.unroute(pattern);
}
