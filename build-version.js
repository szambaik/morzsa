// The version is embedded in this bundle, so an old app cannot display the
// version of a newer deployment fetched from a separate endpoint.
window.MorzsaBuildVersion=(()=>{
 const info=window.MORZSA_BUILD;
 const note=document.createElement('small');note.className='morzsa-build-version';note.setAttribute('data-no-translate','');
 function mount(){
  const host=document.querySelector('.workspace-settings-area');if(!host)return;
  if(note.parentElement!==host)host.append(note);
  const backend=window.MORZSA_CLOUD?.provider==='aws'?'AWS':'Supabase';
  if(!info){const label='Dev · '+backend;if(note.textContent!==label)note.textContent=label;note.title='Local development';return}
  const day=new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Budapest'}).format(new Date(info.builtAt)).replaceAll(' ','');
  const label=day+' · '+(info.shortCommit||info.fingerprint)+' / '+info.fingerprint.slice(0,5)+' · '+backend;if(note.textContent!==label)note.textContent=label;
  const time=new Intl.DateTimeFormat('hu-HU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Budapest'}).format(new Date(info.builtAt));
  note.title='Morzsa · '+info.target+' · '+time+' · '+info.commit+' · '+info.fingerprint+(info.localChanges?' · local changes':'')+' · '+backend;
 }
 new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('morzsa-auth-change',mount);mount();return {info,mount};
})();
