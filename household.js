(() => {
 const config=window.MORZSA_CLOUD||{},configured=!!(config.url&&config.publishableKey),q=document.getElementById('household-dialog');
 const say=(hu,en)=>language==='en'?en:hu;
 let session;try{session=JSON.parse(localStorage.getItem('morzsa-session'))}catch{}
 const cloud=window.household={active:null,rows:[],busy:false,configured,notify:()=>push(),storageKey:()=>cloud.active?'morzsa-household-cache-'+cloud.active:'morzsa-v2'};
 let localBackup=null,authEmail='',pollTimer;
 const incomingLink=AuthLink.consume(location.href);if(incomingLink)history.replaceState(null,'',incomingLink.cleanURL);
 let authPending=!!incomingLink,authNotice='';
 function status(hu,en){document.getElementById('cloud-status').textContent=say(hu,en)}
 function errorText(e){if(e.message?.includes('Conflict'))return say('Valaki közben módosította a listát. Frissítettük; ismételd meg a műveletet.','Someone changed the list. It has been refreshed; repeat your action.');return e.message||say('Nem sikerült kapcsolódni.','Could not connect.')}
 async function request(path,body,auth=true){
  if(!configured)throw Error(say('A felhő még nincs bekötve.','Cloud is not configured yet.'));
  if(auth&&session&&session.expires_at*1000<Date.now()+60000){const r=await fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});const data=await r.json();if(!r.ok)throw Error(say('Jelentkezz be újra.','Please sign in again.'));setSession(data)}
  const response=await fetch(config.url+path,{method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(20000),headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.access_token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{throw Error('Invalid server response')}
  if(!response.ok)throw Error(data?.message||data?.msg||data?.error_description||'Request failed');return data;
 }
 function setSession(value){session=value;if(session&&!session.expires_at)session.expires_at=Math.floor(Date.now()/1000)+(session.expires_in||3600);if(session)localStorage.setItem('morzsa-session',JSON.stringify(session));else localStorage.removeItem('morzsa-session')}
 const rpc=(name,args)=>request('/rest/v1/rpc/'+name,args);
 async function fetchRows(){
  const houses=await request('/rest/v1/households?id=eq.'+cloud.active+'&select=id');if(!houses.length)throw Error(say('A háztartás már nem érhető el.','This household is no longer accessible.'));
  const rows=[];let offset=0;while(true){const part=await request('/rest/v1/household_records?household_id=eq.'+cloud.active+'&select=bucket,key,value,revision&order=bucket,key&limit=1000&offset='+offset);rows.push(...part);if(part.length<1000)break;offset+=part.length}return rows;
 }
 async function refresh(){if(!cloud.active||cloud.busy||q.open||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;cloud.busy=true;try{const rows=await fetchRows();if(JSON.stringify(rows)!==JSON.stringify(cloud.rows)){cloud.rows=rows;state=HouseholdModel.decode(rows,state);render()}status('Közös háztartás · szinkronizálva','Shared household · synced')}catch(e){status('Szinkronizálás sikertelen','Sync failed')}finally{cloud.busy=false}}
 async function push(){
  if(!cloud.active)return;
  if(cloud.busy){state=HouseholdModel.decode(cloud.rows,state);render();toast(say('Mentés folyamatban, próbáld újra.','Saving in progress; try again.'));return}
  const changes=HouseholdModel.diff(cloud.rows,state);if(!changes.length)return true;
  const draft=JSON.stringify(state),hid=cloud.active;try{localStorage.setItem('morzsa-pending-'+hid,draft)}catch{state=HouseholdModel.decode(cloud.rows,state);render();toast(say('A böngésző nem tudta menteni a változtatást.','The browser could not save this change.'));return}cloud.busy=true;status('Mentés…','Saving…');
  try{await rpc('apply_household_changes',{hid,changes});cloud.rows=await fetchRows();state=HouseholdModel.decode(cloud.rows,state);localStorage.setItem(cloud.storageKey(),JSON.stringify(state));localStorage.removeItem('morzsa-pending-'+hid);render();status('Közös háztartás · szinkronizálva','Shared household · synced');return true}
  catch(e){try{cloud.rows=await fetchRows()}catch{}state=HouseholdModel.decode(cloud.rows,state);render();status('Nem sikerült menteni · ismételd meg','Not saved · repeat your action');toast(errorText(e));return false}
  finally{cloud.busy=false}
 }
 async function connect(hid){
  if(cloud.busy)return;const previous=cloud.active;cloud.active=hid;cloud.busy=true;
  try{const rows=await fetchRows();if(!previous)localBackup=JSON.parse(JSON.stringify(state));cloud.rows=rows;state=HouseholdModel.decode(rows,state);render();q.close();status('Közös háztartás · szinkronizálva','Shared household · synced');clearInterval(pollTimer);pollTimer=setInterval(refresh,8000)}catch(e){cloud.active=previous;throw e}finally{cloud.busy=false}
  if(cloud.active===hid&&hasLocalItems()&&!localStorage.getItem(importChoiceKey()))showImportOffer();
 }
 function disconnect(){if(cloud.busy)return;cloud.active=null;clearInterval(pollTimer);if(localBackup){state={...localBackup,likes:state.likes,skips:state.skips,chats:state.chats,sortMode:state.sortMode};localStorage.setItem('morzsa-v2',JSON.stringify(state));localBackup=null;render()}status('Csak ezen az eszközön','This device only')}
 async function run(button,fn){button.disabled=true;const error=q.querySelector('.household-error');error.textContent='';try{await fn()}catch(e){error.textContent=errorText(e)}finally{button.disabled=false}}
 function button(id,hu,en){return '<button class="small-button full" id="'+id+'">'+say(hu,en)+'</button>'}
 async function open(){
  q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><h2>'+say('Közös háztartás','Shared household')+'</h2><p class="household-error" role="alert"></p><div id="household-body"></div>';
  q.querySelector('.close').onclick=()=>q.close();if(!q.open)q.showModal();const body=q.querySelector('#household-body');
  if(!configured){body.innerHTML='<p>'+say('A közös háztartás előkészítve. A bejelentkezéshez és megosztáshoz még be kell kötni a felhőszolgáltatást.','Shared households are prepared. Connect the cloud service to enable sign-in and sharing.')+'</p><p>'+say('Addig a készleted és listád csak ezen a böngészőn mentődik.','Until then, your pantry and list are saved in this browser only.')+'</p>';return}
  if(authPending){body.innerHTML='<p role="status">'+say('Belépési link ellenőrzése…','Checking your sign-in link…')+'</p>';return}
  if(!session){body.innerHTML='<p>'+say('Küldünk egy belépési linket. A levélben kattints a Sign in gombra, és ide érkezel vissza.','We’ll email you a sign-in link. Click Sign in in the email to return here.')+'</p><form id="cloud-signin"><label>Email<input type="email" id="cloud-email" required autocomplete="email" value="'+esc(authEmail)+'"></label><button class="primary full">'+say('Belépési link küldése','Send sign-in link')+'</button></form><p id="signin-feedback" role="status"></p>';
   q.querySelector('.household-error').textContent=authNotice;
   body.querySelector('#cloud-signin').onsubmit=e=>{e.preventDefault();run(e.target.querySelector('button'),async()=>{authEmail=body.querySelector('#cloud-email').value.trim();const redirect=new URL(location.pathname,location.origin).href;await request('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{email:authEmail,create_user:true},false);body.querySelector('#signin-feedback').textContent=say('A belépési linket elküldtük. Nézd meg a postaládádat és a spam mappát is.','Sign-in link sent. Check your inbox and spam folder.');e.target.querySelector('button').textContent=say('Új link küldése','Send another link')})};return;
  }
  body.innerHTML='<p>'+esc(session.user?.email||'')+'</p><p>'+say('Háztartások betöltése…','Loading households…')+'</p>';
  try{const houses=await request('/rest/v1/households?select=id,name,owner_id&order=created_at');body.innerHTML='<p>'+esc(session.user?.email||'')+'</p>'+houses.map(h=>'<button class="small-button full" data-house="'+h.id+'">'+esc(h.name)+(cloud.active===h.id?' ✓':'')+'</button>').join('')+'<form id="create-house"><label>'+say('Új háztartás neve','New household name')+'<input required maxlength="80" name="house-name"></label><button class="primary full">'+say('Létrehozás','Create')+'</button></form><form id="join-house"><label>'+say('Meghívókód','Invitation code')+'<input required name="invite" autocomplete="off"></label><button class="small-button full">'+say('Csatlakozás','Join')+'</button></form>'+(cloud.active?button('cloud-import','Helyi készlet és lista hozzáadása','Import local pantry and list')+button('cloud-disconnect','Vissza a helyi készlethez','Return to local pantry'):'')+button('cloud-signout','Kijelentkezés','Sign out');
   body.querySelectorAll('[data-house]').forEach(b=>b.onclick=()=>run(b,()=>connect(b.dataset.house)));
   body.querySelector('#create-house').onsubmit=e=>{e.preventDefault();run(e.target.querySelector('button'),async()=>{const hid=await rpc('create_household',{household_name:e.target.elements['house-name'].value});await connect(hid)})};
   body.querySelector('#join-house').onsubmit=e=>{e.preventDefault();run(e.target.querySelector('button'),async()=>{const hid=await rpc('join_household',{invite_token:e.target.elements.invite.value.trim()});await connect(hid)})};
   body.querySelector('#cloud-signout').onclick=()=>{if(cloud.busy)return;disconnect();setSession(null);open()};
   if(cloud.active){body.querySelector('#cloud-disconnect').onclick=()=>{disconnect();open()};body.querySelector('#cloud-import').onclick=()=>showImportPreview();
   const h=houses.find(h=>h.id===cloud.active);if(h?.owner_id===session.user?.id){body.insertAdjacentHTML('beforeend',button('cloud-invite','Meghívókód készítése','Create invitation code')+'<output id="invite-output"></output>'+button('revoke-invites','Függő meghívók visszavonása','Revoke pending invitations'));body.querySelector('#cloud-invite').onclick=e=>run(e.target,async()=>{const token=await rpc('invite_household',{hid:cloud.active});body.querySelector('#invite-output').textContent=say('Egyszer használható, 2 napig érvényes kód: ','Single-use code, valid for 2 days: ')+token});body.querySelector('#revoke-invites').onclick=e=>run(e.target,async()=>{await rpc('revoke_household_invites',{hid:cloud.active});body.querySelector('#invite-output').textContent=say('Meghívók visszavonva.','Invitations revoked.')});}
   }
  }catch(e){q.querySelector('.household-error').textContent=errorText(e)}
 }
 function importChoiceKey(){return 'morzsa-import-choice-'+session.user.id+'-'+cloud.active}
 function hasLocalItems(){return localBackup&&(Object.values(localBackup.stock).some(v=>v>0)||localBackup.cart.length||localBackup.custom.length)}
 function finishImportPrompt(choice){try{localStorage.setItem(importChoiceKey(),choice)}catch{}q.close()}
 function importFrame(title){q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><h2>'+title+'</h2><p class="household-error" role="alert"></p><div id="household-body"></div>';q.querySelector('.close').onclick=()=>q.close();if(!q.open)q.showModal();return q.querySelector('#household-body')}
 function showImportOffer(){
  const body=importFrame(say('Hozzuk a saját készletedet?','Bring your local pantry?'));
  body.innerHTML='<p>'+say('Ezen az eszközön már van készleted vagy bevásárlólistád. Hozzáadod őket a közös háztartáshoz?','You already have pantry or shopping items on this device. Would you like to add them to the shared household?')+'</p><p>'+Object.values(localBackup.stock).filter(v=>v>0).length+say(' otthoni tétel · ',' pantry items · ')+localBackup.cart.length+say(' listatétel',' shopping items')+'</p>'+button('review-import','Átnézem és hozzáadom','Review and import')+button('skip-import','Most kihagyom','Skip for now')+'<p class="helper">'+say('A helyi adataid megmaradnak. Később a házikó menüjéből is importálhatsz.','Your local data is kept. You can import later from the household menu.')+'</p>';
  body.querySelector('#review-import').onclick=showImportPreview;body.querySelector('#skip-import').onclick=()=>finishImportPrompt('skipped');
 }
 function showImportPreview(){
  if(!localBackup||!cloud.active)return;
  const plan=HouseholdModel.importPlan(localBackup,state),body=importFrame(say('Import áttekintése','Review import'));
  const sections=[['stock','Készlet','Pantry'],['cart','Bevásárlólista','Shopping list'],['custom','Saját tételek','Custom items']];
  body.innerHTML=sections.map(([key,hu,en])=>'<details class="archive-entry" open><summary>'+say(hu,en)+' · +'+plan.added[key].length+'</summary>'+plan.added[key].map(name=>'<div class="archive-row"><span>'+esc(displayName(name))+'</span>'+(key==='cart'?'<span>'+esc(language==='en'?englishText(cartAmount(localBackup.cart.find(x=>x.name===name))):cartAmount(localBackup.cart.find(x=>x.name===name)))+'</span>':'')+'</div>').join('')+(plan.kept[key].length?'<p class="helper">'+say('Már szerepel, változatlan marad: ','Already present, kept unchanged: ')+plan.kept[key].map(n=>esc(displayName(n))).join(', ')+'</p>':'')+'</details>').join('')+'<p class="helper">'+say('A közös állapotot megtartjuk. A mennyiségeket nem adjuk össze. A helyi archívum, kedvencek és beszélgetések ezen az eszközön maradnak.','Shared values are kept; quantities are not added together. Local history, favourites and chats stay on this device.')+'</p>'+button('confirm-import','Hozzáadás a közös háztartáshoz','Import into shared household')+button('cancel-import','Most kihagyom','Skip for now');
  body.querySelector('#cancel-import').onclick=()=>finishImportPrompt('skipped');
  body.querySelector('#confirm-import').onclick=e=>run(e.target,async()=>{
   state=HouseholdModel.importPlan(localBackup,state).next;
   if(await push()){finishImportPrompt('imported');toast(say('A helyi tételeket hozzáadtuk.','Local items imported.'))}
   else {q.querySelector('.household-error').textContent=say('Az import nem sikerült. A helyi adataid megmaradtak. Nyisd meg újra az áttekintést.','Import failed. Your local data is safe. Reopen the review before retrying.');body.querySelector('#confirm-import').onclick=showImportPreview;body.querySelector('#confirm-import').textContent=say('Friss áttekintés','Review again')}
  });
 }
 async function receiveLink(){
  if(!incomingLink)return;
  await open();
  try{if(!configured)throw Error('not-configured');const verified=await AuthLink.validate(incomingLink,config);setSession(verified);authNotice=''}
  catch(e){authNotice=say('Ez a belépési link érvénytelen, lejárt, vagy nem sikerült ellenőrizni. Kérj új linket.','This sign-in link is invalid, expired or could not be verified. Request a new link.');}
  finally{authPending=false;incomingLink.access=null;incomingLink.refresh=null;await open();if(authNotice)q.querySelector('.household-error').textContent=authNotice}
 }
 document.getElementById('household-button').onclick=open;
 // Freeze mutations until a write is acknowledged; other devices use revision checks.
 for(const event of ['click','submit','pointerdown','keydown'])document.addEventListener(event,e=>{if(cloud.busy&&e.target.closest('#main,#quantity-dialog,#clear-dialog,#history-dialog')){e.preventDefault();e.stopImmediatePropagation()}},true);
 window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 status('Csak ezen az eszközön','This device only');
 receiveLink();
 cloud.updateLanguage=()=>status(cloud.active?'Közös háztartás':'Csak ezen az eszközön',cloud.active?'Shared household':'This device only');
})();
