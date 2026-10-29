// Playwright browser_run_code_unsafe runner: isolated context and mocked Supabase.
// Start server.py on localhost:8769, then run this file through that tool.
async (page) => {
 const context=await page.context().browser().newContext({viewport:{width:390,height:844}}),p=await context.newPage();
 const check=(ok,message)=>{if(!ok)throw Error(message)};
 const homes=[{id:'a',name:'Otthon',owner_id:'member'},{id:'b',name:'Nyaraló és egy nagyon hosszú háztartásnév',owner_id:'member'}];
 const records={a:[{bucket:'stock',key:'Rizs',value:2,revision:1}],b:[{bucket:'stock',key:'Házi szósz',value:2,revision:1},{bucket:'custom',key:'Házi szósz',value:{name:'Házi szósz',emoji:'🍅',category:'Saját tételek'},revision:1},{bucket:'cart',key:'Tej',value:{name:'Tej',quantity:5},revision:1}]};
 let invites=[],revoked=false,writes=0;const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{if(localStorage.getItem('test-seeded'))return;localStorage.setItem('test-seeded','yes');localStorage.setItem('morzsa-v1',JSON.stringify({stock:{Tojás:1},cart:[],custom:[],likes:[]}));localStorage.setItem('morzsa-session',JSON.stringify({access_token:'mock',expires_at:9999999999,user:{id:'member',email:'test@example.com'}}))});
 await p.route('https://cbgcugshwivxpaurzyqq.supabase.co/**',async route=>{
  const url=route.request().url(),json=data=>route.fulfill({json:data});
  if(url.includes('/households?')){const id=url.split('id=eq.')[1]?.split('&')[0];return json(id?homes.filter(h=>h.id===id&&!(revoked&&id==='new')):homes)}
  if(url.includes('/household_records?'))return json(records[url.split('household_id=eq.')[1].split('&')[0]]||[]);
  if(url.includes('list_household_email_invites'))return json(invites);
  if(url.includes('list_sent_household_invites'))return json([]);
  if(url.includes('create_household')){homes.push({id:'new',name:route.request().postDataJSON().household_name,owner_id:'member'});records.new=[];return json('new')}
  if(url.includes('respond_household_email_invite')){invites=[];return json('b')}
  if(url.includes('apply_household_changes')){writes++;const {hid,changes}=route.request().postDataJSON();for(const change of changes){const row={...change,revision:change.expected+1},i=records[hid].findIndex(x=>x.bucket===change.bucket&&x.key===change.key);if(i<0)records[hid].push(row);else records[hid][i]=row}return json(null)}
  return json([]);
 });
 const active=()=>p.evaluate(()=>window.household.active);
 const choose=async id=>{await p.locator('#household-button').click();await p.locator('[data-house="'+id+'"]').click();await p.locator('#household-dialog').waitFor({state:'hidden'})};
 try{
  await p.goto('http://localhost:8769/');await choose('a');check(await active()==='a','house a selected');check(await p.locator('.household-name').textContent()==='Otthon','active name visible');
  await p.reload();await p.waitForFunction(()=>household.active==='a');check(await p.evaluate(()=>!state.stock.Tojás&&state.stock.Rizs===2),'restore does not import local stock');
  await choose('b');await p.reload();await p.waitForFunction(()=>household.active==='b');
  for(const width of [320,390]){await p.setViewportSize({width,height:844});check(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'header overflow');}
  await p.screenshot({path:'/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/household-header-preview.jpg'});
  await p.locator('#household-button').click();await p.locator('#cloud-disconnect').click();await p.locator('#household-dialog .close').click();await p.reload();check(await active()===null,'local choice persists');check(await p.evaluate(()=>state.stock.Tojás===1),'legacy local pantry preserved');
  await choose('a');invites=[{id:'inv',household_name:homes[1].name}];await p.locator('#household-button').click();await p.locator('[data-accept=inv]').click();await p.locator('#household-dialog').waitFor({state:'hidden'});check(await active()==='b','accepted invitation switches');
  await p.locator('#household-button').click();await p.locator('[name=house-name]').fill('Új közös otthon');await p.locator('#create-house button').click();await p.locator('#skip-pantry-copy').waitFor();check(await active()==='new','creation switches');check(writes===0,'creation does not silently copy');
  await p.screenshot({path:'/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/household-create-preview.jpg'});
  const original=JSON.stringify(records.b);await p.locator('#pantry-copy-source').selectOption('b');await p.locator('#copy-local-pantry').click();await p.locator('#local-pantry-feedback').filter({hasText:'1 terméket'}).waitFor();check(JSON.stringify(records.b)===original,'source pantry untouched');check(records.new.some(x=>x.bucket==='custom')&&!records.new.some(x=>x.bucket==='cart'),'only pantry and relevant custom copied');
  await p.locator('#pantry-copy-source').selectOption('b');await p.locator('#copy-local-pantry').click();await p.locator('#local-pantry-feedback').filter({hasText:'Nincs új'}).waitFor();check(writes===1,'repeat copy idempotent');
  await p.locator('#cloud-signout').click();check(await p.evaluate(()=>JSON.parse(localStorage.getItem('morzsa-last-household-member')).id)==='new','signout preserves preference');
  await p.evaluate(()=>localStorage.setItem('morzsa-session',JSON.stringify({access_token:'mock',expires_at:9999999999,user:{id:'other'}})));await p.reload();check(await active()===null,'preference isolated by user');
  await p.evaluate(()=>localStorage.setItem('morzsa-session',JSON.stringify({access_token:'mock',expires_at:9999999999,user:{id:'member'}})));revoked=true;await p.reload();await p.waitForFunction(()=>!household.busy);check(await active()===null,'revoked household does not load');check(await p.evaluate(()=>state.stock.Tojás===1),'failed restore keeps local data');
  check(errors.length===0,'browser errors: '+errors.join(','));return {passed:true,writes,checks:'switch, reload, local default, invitation, creation, source copy, idempotence, logout, account isolation, revoked membership, mobile layout'};
 }finally{await context.close()}
}
