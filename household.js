(() => {
 const config=window.MORZSA_CLOUD||{},configured=!!(config.url&&config.publishableKey),q=document.getElementById('household-dialog');
 const say=(hu,en)=>language==='en'?en:hu;
 let session;try{session=JSON.parse(localStorage.getItem('morzsa-session'))}catch{}
 const cloud=window.household={active:null,rows:[],busy:false,configured,notify:()=>push(),storageKey:()=>cloud.active?'morzsa-household-cache-'+cloud.active:'morzsa-v2'};
 let localBackup=null,authEmail='',authMode='login',recoveryMode=false,pollTimer,invitations=[],inviteUnavailable=false,inviteLoading=false;
 const incomingLink=AuthLink.consume(location.href);if(incomingLink)history.replaceState(null,'',incomingLink.cleanURL);
 let authPending=!!incomingLink,authNotice='';
 function status(hu,en){const el=document.getElementById('cloud-status');el.textContent=say(hu,en);el.hidden=['Csak ezen az eszközön','Közös háztartás · szinkronizálva','Közös háztartás'].includes(hu)}
 function errorText(e){if(e.message?.includes('Invalid login credentials'))return say('Hibás email-cím vagy jelszó.','Incorrect email or password.');if(e.message?.includes('Email not confirmed'))return say('Előbb erősítsd meg az email-címedet a kapott levélben.','Confirm your email using the message in your inbox first.');if(e.message?.includes('Conflict'))return say('Valaki közben módosította a listát. Frissítettük; ismételd meg a műveletet.','Someone changed the list. It has been refreshed; repeat your action.');return e.message||say('Nem sikerült kapcsolódni.','Could not connect.')}
 async function request(path,body,auth=true,method=body===undefined?'GET':'POST'){
  if(!configured)throw Error(say('A felhő még nincs bekötve.','Cloud is not configured yet.'));
  if(auth&&session&&session.expires_at*1000<Date.now()+60000){const r=await fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',signal:AbortSignal.timeout(20000),headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});const data=await r.json();if(!r.ok)throw Error(say('Jelentkezz be újra.','Please sign in again.'));setSession(data)}
  const response=await fetch(config.url+path,{method,signal:AbortSignal.timeout(20000),headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.access_token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{throw Error('Invalid server response')}
  if(!response.ok)throw Error(data?.message||data?.msg||data?.error_description||'Request failed');return data;
 }
 function setSession(value){session=value;if(session&&!session.expires_at)session.expires_at=Math.floor(Date.now()/1000)+(session.expires_in||3600);if(session)localStorage.setItem('morzsa-session',JSON.stringify(session));else localStorage.removeItem('morzsa-session');invitations=[];paintInviteBadge()}
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
  try{const rows=await fetchRows();if(!previous)localBackup=JSON.parse(JSON.stringify(state));cloud.rows=rows;homeUndo.length=0;shoppingDraft='';pantryDraft='';pantryBatch=[];pantryListed.clear();state=HouseholdModel.decode(rows,state);render();q.close();status('Közös háztartás · szinkronizálva','Shared household · synced');clearInterval(pollTimer);pollTimer=setInterval(refresh,8000)}catch(e){cloud.active=previous;throw e}finally{cloud.busy=false}
 }
 function disconnect(){if(cloud.busy)return;homeUndo.length=0;shoppingDraft='';pantryDraft='';pantryBatch=[];pantryListed.clear();cloud.active=null;clearInterval(pollTimer);if(localBackup){state={...localBackup,likes:state.likes,skips:state.skips,chats:state.chats,sortMode:state.sortMode};localStorage.setItem('morzsa-v2',JSON.stringify(state));localBackup=null;render()}status('Csak ezen az eszközön','This device only')}
 async function run(button,fn){button.disabled=true;const error=q.querySelector('.household-error');error.textContent='';try{await fn()}catch(e){error.textContent=errorText(e)}finally{button.disabled=false}}
 function button(id,hu,en){return '<button class="small-button full" id="'+id+'">'+say(hu,en)+'</button>'}
 async function open(){
  q.innerHTML='<button class="close" aria-label="'+say('Bezárás','Close')+'">×</button><h2>'+say('Közös háztartás','Shared household')+'</h2><p class="household-error" role="alert"></p><div id="household-body"></div>';
  q.querySelector('.close').onclick=()=>q.close();if(!q.open)q.showModal();const body=q.querySelector('#household-body');
  if(!configured){body.innerHTML='<p>'+say('A közös háztartás előkészítve. A bejelentkezéshez és megosztáshoz még be kell kötni a felhőszolgáltatást.','Shared households are prepared. Connect the cloud service to enable sign-in and sharing.')+'</p><p>'+say('Addig a készleted és listád csak ezen a böngészőn mentődik.','Until then, your pantry and list are saved in this browser only.')+'</p>';return}
  if(authPending){body.innerHTML='<p role="status">'+say('Belépési link ellenőrzése…','Checking your sign-in link…')+'</p>';return}
  if(recoveryMode){paintPasswordReset(body);return}
  if(!session){paintAuth(body);return}
  body.innerHTML='<p>'+esc(session.user?.email||'')+'</p><p>'+say('Háztartások betöltése…','Loading households…')+'</p>';
  try{const houses=await request('/rest/v1/households?select=id,name,owner_id&order=created_at');await loadInvitations();body.innerHTML='<p>'+esc(session.user?.email||'')+'</p>'+houses.map(h=>'<button class="small-button full" data-house="'+h.id+'">'+esc(h.name)+(cloud.active===h.id?' ✓':'')+'</button>').join('')+'<form id="create-house"><label>'+say('Új háztartás neve','New household name')+'<input required maxlength="80" name="house-name"></label><button class="primary full">'+say('Létrehozás','Create')+'</button></form>'+(cloud.active?button('cloud-disconnect','Vissza a helyi készlethez','Return to local pantry'):'')+button('cloud-signout','Kijelentkezés','Sign out');
   body.insertAdjacentHTML('afterbegin','<section id="incoming-invitations"></section>');paintInvitations();
   body.querySelectorAll('[data-house]').forEach(b=>b.onclick=()=>run(b,()=>connect(b.dataset.house)));
   body.querySelector('#create-house').onsubmit=e=>{e.preventDefault();run(e.target.querySelector('button'),async()=>{const hid=await rpc('create_household',{household_name:e.target.elements['house-name'].value});await connect(hid)})};

   body.querySelector('#cloud-signout').onclick=()=>{if(cloud.busy)return;disconnect();setSession(null);open()};
   if(cloud.active){body.querySelector('#cloud-disconnect').onclick=()=>{disconnect();open()};
   const h=houses.find(h=>h.id===cloud.active);if(h?.owner_id===session.user?.id){
    body.insertAdjacentHTML('beforeend','<form id="invite-email"><label>'+say('Meghívás email-cím alapján','Invite by email')+'<input name="email" type="email" maxlength="254" required autocomplete="email" placeholder="nev@gmail.com"></label><button class="primary full" '+(inviteUnavailable?'disabled':'')+'>'+say('Meghívás','Invite')+'</button></form><p class="helper">'+say('A meghívott ezzel az email-címmel belépve az appban fogadhatja el. A meghívás 7 napig érvényes.','The recipient can accept in the app after signing in with this email. Invitations expire in 7 days.')+'</p><div id="sent-invitations"></div>');
    body.querySelector('#invite-email').onsubmit=e=>{e.preventDefault();run(e.target.querySelector('button'),async()=>{await rpc('send_household_email_invite',{hid:cloud.active,recipient_email:e.target.elements.email.value.trim()});e.target.reset();toast(say('Meghívás létrehozva.','Invitation created.'));await paintSentInvitations(cloud.active)})};
    if(!inviteUnavailable)await paintSentInvitations(cloud.active);
   }
   }
  }catch(e){q.querySelector('.household-error').textContent=errorText(e)}
 }
 function paintInviteBadge(){
  paintAccount();
  const button=document.getElementById('household-button');button.querySelector('.invite-badge')?.remove();
  button.setAttribute('aria-label',say('Háztartás','Household')+(invitations.length?' · '+invitations.length+' '+say('meghívás','invitations'):''));
  if(invitations.length)button.insertAdjacentHTML('beforeend','<span class="invite-badge" aria-hidden="true">'+invitations.length+'</span>');
 }
 async function loadInvitations(){
  if(!session||!configured||inviteLoading)return;inviteLoading=true;const uid=session.user?.id;
  try{const rows=await rpc('list_household_email_invites',{});if(session?.user?.id!==uid)return;invitations=rows;inviteUnavailable=false;paintInviteBadge();const section=q.querySelector("#incoming-invitations");if(section&&!section.contains(document.activeElement))paintInvitations()}
  catch(e){if(session?.user?.id===uid){inviteUnavailable=true}}
  finally{inviteLoading=false}
 }
 function paintInvitations(){
  const section=q.querySelector('#incoming-invitations');if(!section)return;
  section.innerHTML=inviteUnavailable?'<p class="helper">'+say('A meghívások most nem érhetők el. A szolgáltatást még be kell kapcsolni, vagy a kapcsolat szakadt meg.','Invitations are currently unavailable. Setup may be incomplete, or the connection was interrupted.')+'</p>':invitations.map(i=>'<article class="invitation-card"><h3>'+esc(i.household_name)+'</h3><p>'+say('Meghívtak ebbe a háztartásba.','You have been invited to this household.')+'</p><div class="invitation-actions"><button class="primary" data-accept="'+esc(i.id)+'">'+say('Elfogadom','Accept')+'</button><button class="small-button" data-decline="'+esc(i.id)+'">'+say('Elutasítom','Decline')+'</button></div></article>').join('');
  section.querySelectorAll('[data-accept],[data-decline]').forEach(b=>b.onclick=()=>run(b,async()=>{const accept=!!b.dataset.accept;const hid=await rpc('respond_household_email_invite',{invitation_id:b.dataset.accept||b.dataset.decline,accept_invite:accept});await loadInvitations();if(accept)await connect(hid);else paintInvitations()}));
 }
 async function paintSentInvitations(hid){
  const rows=await rpc('list_sent_household_invites',{hid}),el=q.querySelector('#sent-invitations');if(!el||cloud.active!==hid)return;
  const labels={pending:say('Függőben','Pending'),accepted:say('Elfogadva','Accepted'),declined:say('Elutasítva','Declined'),revoked:say('Visszavonva','Revoked')};
  el.innerHTML=rows.map(i=>'<div class="invite-sent"><span>'+esc(i.email)+'<br>'+((i.status==='pending'&&new Date(i.expires_at)<new Date())?say('Lejárt','Expired'):labels[i.status])+'</span>'+(i.status==='pending'?'<button class="small-button" data-revoke="'+esc(i.id)+'">'+say('Visszavonás','Revoke')+'</button>':'')+'</div>').join('');
  el.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=()=>run(b,async()=>{await rpc('revoke_household_email_invite',{invitation_id:b.dataset.revoke});await paintSentInvitations(hid)}));
 }
 function paintAccount(){const b=document.getElementById('account-button');if(b){b.textContent=session?say('Fiókom','Account'):say('Belépés','Sign in');b.setAttribute('aria-label',session?say('Fiókom és háztartásaim','Account and households'):say('Belépés vagy regisztráció','Sign in or register'))}}
 function paintAuth(body){
  const signup=authMode==='signup',reset=authMode==='reset';q.querySelector('h2').textContent=reset?say('Új jelszó kérése','Reset password'):signup?say('Regisztráció','Create account'):say('Belépés','Sign in');
  body.innerHTML='<div class="auth-tabs"><button data-auth="login" aria-pressed="'+(!signup&&!reset)+'">'+say('Belépés','Sign in')+'</button><button data-auth="signup" aria-pressed="'+signup+'">'+say('Regisztráció','Register')+'</button></div><form id="password-auth"><label>Email<input name="email" type="email" required autocomplete="username" value="'+esc(authEmail)+'"></label>'+(!reset?'<label>'+say('Jelszó','Password')+'<input name="password" type="password" required '+(signup?'minlength="8"':'')+' autocomplete="'+(signup?'new-password':'current-password')+'"></label>'+(signup?'<p class="helper">'+say('Legalább 8 karakter. A regisztráció után igazold az email-címedet a kapott levélben.','At least 8 characters. Confirm your email using the message sent after registration.')+'</p>':''):'<p>'+say('Küldünk egy jelszóbeállító linket. Ezzel korábbi, linkkel létrehozott fiókodhoz is beállíthatsz jelszót.','We will send a password reset link. You can also use it to set a password for an account previously accessed with email links.')+'</p>')+'<button class="primary full">'+(reset?say('Jelszóbeállító levél kérése','Send reset email'):signup?say('Fiók létrehozása','Create account'):say('Belépés','Sign in'))+'</button></form><p id="signin-feedback" role="status"></p>'+(!reset?button('forgot-password','Elfelejtett / még nincs jelszavam','Forgot / no password yet')+button('google-signin','Belépés Google-fiókkal','Continue with Google'):'');
  body.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>{authEmail=body.querySelector('[name=email]').value;authMode=b.dataset.auth;authNotice='';open()});
  const forgot=body.querySelector('#forgot-password');if(forgot)forgot.onclick=()=>{authEmail=body.querySelector('[name=email]').value;authMode='reset';open()};
  body.querySelector('#password-auth').onsubmit=e=>{e.preventDefault();const form=e.target;run(form.querySelector('button'),async()=>{
   authEmail=form.elements.email.value.trim();const password=form.elements.password?.value;const redirect=encodeURIComponent(new URL(location.pathname,location.origin).href);
   try{
    if(reset){await request('/auth/v1/recover?redirect_to='+redirect,{email:authEmail},false);body.querySelector('#signin-feedback').textContent=say('Ha a címhez tartozik fiók, hamarosan megérkezik a jelszóbeállító levél.','If an account exists for this email, a reset message will arrive shortly.');return}
    const data=await request(signup?'/auth/v1/signup?redirect_to='+redirect:'/auth/v1/token?grant_type=password',{email:authEmail,password},false);
    if(data.access_token){setSession(data);authMode='login';authNotice='';await open()}
    else body.querySelector('#signin-feedback').textContent=say('Nézd meg a postaládádat az email-cím megerősítéséhez. Ha már van fiókod, válaszd a Belépést vagy kérj új jelszót.','Check your inbox to confirm your email. If you already have an account, sign in or reset your password.');
   }finally{if(form.elements.password)form.elements.password.value=''}
  })};
  const google=body.querySelector('#google-signin');if(google){google.classList.add('google-signin');google.innerHTML='<img src="assets/brands/google.svg" width="20" height="20" alt=""><span>'+say('Folytatás Google-fiókkal','Continue with Google')+'</span>';body.prepend(google);const divider=document.createElement('div');divider.className='auth-divider';divider.textContent=say('vagy emaillel','or with email');google.after(divider);google.onclick=e=>run(e.currentTarget,async()=>{const settings=await request('/auth/v1/settings',undefined,false);if(!settings.external?.google)throw Error(say('A Google-belépés még nincs bekapcsolva. Használd az emailt és jelszót.','Google sign-in is not enabled yet. Use email and password.'));const url=new URL(config.url+'/auth/v1/authorize');url.searchParams.set('provider','google');url.searchParams.set('redirect_to',new URL(location.pathname,location.origin).href);location.assign(url.href)})}
  q.querySelector('.household-error').textContent=authNotice;
 }
 function paintPasswordReset(body){
  q.querySelector('h2').textContent=say('Új jelszó beállítása','Set a new password');body.innerHTML='<form id="new-password"><label>'+say('Új jelszó · legalább 8 karakter','New password · at least 8 characters')+'<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label>'+say('Jelszó újra','Repeat password')+'<input name="confirmation" type="password" required minlength="8" autocomplete="new-password"></label><button class="primary full">'+say('Jelszó mentése','Save password')+'</button></form>';
  body.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.target;run(form.querySelector('button'),async()=>{if(form.elements.password.value!==form.elements.confirmation.value)throw Error(say('A két jelszó nem egyezik.','The passwords do not match.'));await request('/auth/v1/user',{password:form.elements.password.value},true,'PUT');form.reset();recoveryMode=false;authMode='login';await open();toast(say('A jelszavadat elmentettük.','Your password has been saved.'))})};
 }
 async function receiveLink(){
  if(!incomingLink)return;
  await open();
  try{if(!configured)throw Error('not-configured');const verified=await AuthLink.validate(incomingLink,config);setSession(verified);recoveryMode=incomingLink.type==='recovery';authNotice=''}
  catch(e){authNotice=say('Ez a belépési link érvénytelen, lejárt, vagy nem sikerült ellenőrizni. Kérj új linket.','This sign-in link is invalid, expired or could not be verified. Request a new link.');}
  finally{authPending=false;incomingLink.access=null;incomingLink.refresh=null;await open();if(authNotice)q.querySelector('.household-error').textContent=authNotice}
 }
 document.getElementById('household-button').onclick=open;
 const account=document.createElement('button');account.id='account-button';account.setAttribute('data-no-translate','');document.querySelector('.header-controls').prepend(account);account.onclick=open;paintAccount();
 // Freeze mutations until a write is acknowledged; other devices use revision checks.
 for(const event of ['click','submit','pointerdown','keydown'])document.addEventListener(event,e=>{if(cloud.busy&&e.target.closest('#main,#quantity-dialog,#clear-dialog,#history-dialog')){e.preventDefault();e.stopImmediatePropagation()}},true);
 window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 status('Csak ezen az eszközön','This device only');
 receiveLink();
 loadInvitations();setInterval(async()=>{if(document.hidden||authPending)return;await loadInvitations();if(q.open&&!q.contains(document.activeElement))paintInvitations()},30000);
 window.addEventListener('focus',()=>loadInvitations());
 cloud.updateLanguage=()=>{paintAccount();status(cloud.active?'Közös háztartás':'Csak ezen az eszközön',cloud.active?'Shared household':'This device only')};
})();
