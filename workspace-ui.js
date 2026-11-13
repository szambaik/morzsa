// The selected Kitchen Companion direction uses the existing household stores.
window.MorzsaWorkspace=(()=>{
 const say=(hu,en)=>language==='en'?en:hu;
 const glyph=name=>'<img class="workspace-icon" src="assets/ui/'+name+'.svg" alt="" aria-hidden="true">';
 const nav=document.querySelector('.app>nav'),mobileParent=nav.parentElement;
 const order=['overview','pantry','chat','shopping','recipes'];
 const navIcons={overview:'layout-grid',pantry:'house',shopping:'shopping-cart',recipes:'chef-hat'};
 const sidebar=document.createElement('aside');sidebar.id='workspace-sidebar';sidebar.hidden=true;sidebar.setAttribute('data-no-translate','');
 sidebar.innerHTML='<a class="workspace-brand" href="#">'+document.querySelector('header .brand').innerHTML+'</a><div class="workspace-navigation"></div><div class="workspace-history"></div>';
 sidebar.querySelector('a').onclick=e=>{e.preventDefault();window.MorzsaCompanion.open()};document.body.append(sidebar);
 const dock=document.createElement('section');dock.id='workspace-assistant';dock.hidden=true;dock.setAttribute('data-no-translate','');document.body.append(dock);
 let dockLanguage='',quick=null,names=[],draft='',target='stock',entryContext='',working=false;
 const fastMarkup=()=>main.querySelector('.cooking-guide')?'':'<div class="workspace-fast-actions" role="group" aria-label="'+say('Gyors műveletek','Quick actions')+'">'+(!['pantry','shopping'].includes(page)?'<button type="button" data-workspace-add="stock">'+glyph('plus')+say('Hozzáadás','Quick add')+'</button>':'')+(page==='chat'?'<button type="button" data-workspace-new-chat aria-label="'+say('Új beszélgetés','New chat')+'">'+glyph('message-circle')+say('Új chat','New chat')+'</button>':'')+(page!=='chat'?'<button class="workspace-context-assistant" type="button" data-workspace-assistant><img src="assets/brands/morzsa.svg" alt="" width="23" height="23">'+say('Kérdezz Morzsától','Ask Morzsa')+'</button>':'')+'</div>';
 function bindFast(host){host.querySelector('[data-workspace-new-chat]')?.addEventListener('click',()=>window.MorzsaCompanion.newChat());host.querySelectorAll('[data-workspace-add]').forEach(b=>b.onclick=()=>openEntry(b.dataset.workspaceAdd));host.querySelector('[data-workspace-assistant]')?.addEventListener('click',()=>window.MorzsaCompanion.openContext(page))}
 function mount(){
  for(const [index,destination] of order.entries()){const button=nav.querySelector('[data-page="'+destination+'"]');if(nav.children[index]!==button)nav.insertBefore(button,nav.children[index]||null);const labels={overview:say('Áttekintés','Overview'),pantry:say('Készlet','Pantry'),chat:'Morzsa',shopping:say('Lista','List'),recipes:say('Receptek','Recipes')};for(const node of button.childNodes)if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim())node.textContent=labels[destination]+' ';const span=button.querySelector('span');if(navIcons[destination]&&!span.querySelector('.workspace-icon'))span.innerHTML=glyph(navIcons[destination]);}
  const desktop=matchMedia('(min-width:1000px)').matches;sidebar.hidden=!desktop;
  const navHost=desktop?sidebar.querySelector('.workspace-navigation'):mobileParent;if(nav.parentElement!==navHost)navHost.append(nav);
  const rail=document.getElementById('companion-history-rail');if(rail&&rail.parentElement!==sidebar.querySelector('.workspace-history'))sidebar.querySelector('.workspace-history').append(rail);
  const local=main.querySelector('.companion-compose-wrap,.room-compose-wrap');dock.hidden=!!local;dock.classList.toggle('workspace-quick-only',page!=='chat');
  if(local){let fast=local.querySelector('.workspace-fast-actions');if(!fast){local.insertAdjacentHTML('afterbegin',fastMarkup());bindFast(local);}}
  else if(!dock.querySelector('form')||dockLanguage!==language+'|'+page){dockLanguage=language+'|'+page;const value=dock.querySelector('input')?.value||'';dock.innerHTML=fastMarkup()+'<form class="workspace-composer"><input aria-label="'+say('Üzenet Morzsának','Message Morzsa')+'" placeholder="'+say('Kérdezz Morzsától…','Ask Morzsa…')+'" maxlength="2000"><button type="button" data-workspace-voice aria-label="'+say('Kérdezés hanggal','Ask by voice')+'">'+glyph('mic')+'</button><button type="submit" aria-label="'+say('Küldés','Send')+'">'+glyph('arrow-up')+'</button></form>';dock.querySelector('input').value=value;bindFast(dock);
   dock.querySelector('form').onsubmit=e=>{e.preventDefault();const input=dock.querySelector('input'),text=input.value.trim();if(text&&window.MorzsaCompanion.ask(text)!==false)input.value=''};
   dock.querySelector('[data-workspace-voice]').onclick=()=>window.MorzsaCompanion.voice();
  }
  document.body.classList.toggle('workspace-cooking',page==='chat'&&!!main.querySelector('.cooking-guide'));document.body.classList.toggle('workspace-chat',page==='chat');dock.dataset.context=page;document.body.classList.toggle('workspace-local-compose',!!local);
  document.documentElement.style.setProperty('--workspace-nav-height',desktop?'0px':nav.getBoundingClientRect().height+'px');
  if(quick?.open&&entryContext!==voiceContext())quick.close();
  window.MorzsaOnboarding?.mount();document.body.classList.toggle('introduction-active',!!main.querySelector('.morzsa-introduction'));
   window.KitchenIntelligence?.mount();
 }
 function openEntry(destination,initialDraft){
  if(working)return;
  const nextContext=voiceContext();if(entryContext!==nextContext){names=[];draft='';entryContext=nextContext}target=destination;if(typeof initialDraft==='string')draft=initialDraft;
  if(!quick){quick=document.createElement('dialog');quick.id='workspace-entry';quick.setAttribute('data-no-translate','');document.body.append(quick);PanelGestures.bind(quick,{axis:'y',disabled:()=>working});}
  quick.innerHTML='<div class="workspace-sheet-handle" aria-hidden="true"></div><div class="workspace-entry-head"><h2>'+say('Gyors felvétel','Quick add')+'</h2><button type="button" data-entry-close aria-label="'+say('Bezárás','Close')+'">'+glyph('x')+'</button></div><div class="workspace-entry-target" role="group" aria-label="'+say('Hová kerüljön?','Destination')+'"><button data-entry-target="stock">'+glyph('house')+say('Készletbe','To pantry')+'</button><button data-entry-target="cart">'+glyph('shopping-cart')+say('Listára','To list')+'</button></div><form><input role="combobox" aria-label="'+say('Termékek gyors felvétele','Quickly add products')+'" aria-autocomplete="list" aria-controls="workspace-entry-options" aria-expanded="false" placeholder="'+say('Tej, kenyér, alma…','Milk, bread, apples…')+'" autocomplete="off" enterkeyhint="done" maxlength="2000"></form><div id="workspace-entry-options" role="listbox"></div><div class="workspace-entry-batch"></div><p class="workspace-entry-hint">'+say('Vessző vagy Enter: még egy tétel. Pontos mennyiség nem kell.','Comma or Enter: another item. Exact quantities are optional.')+'</p><p class="workspace-entry-status" role="status"></p><button class="primary workspace-entry-save" type="button">'+glyph('plus')+say('Hozzáadom','Add')+'</button>';
  const input=quick.querySelector('input'),options=quick.querySelector('#workspace-entry-options'),status=quick.querySelector('.workspace-entry-status');input.value=draft;let choices=[],active=-1;
  const targetButtons=()=>quick.querySelectorAll('[data-entry-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.entryTarget===target)));
  const batch=()=>{quick.querySelector('.workspace-entry-batch').innerHTML=names.map((name,i)=>'<span class="workspace-entry-chip">'+esc(displayName(name))+'<button type="button" data-entry-remove="'+i+'" aria-label="'+esc(displayName(name))+': '+say('kivétel','remove')+'">'+glyph('x')+'</button></span>').join('');quick.querySelectorAll('[data-entry-remove]').forEach(b=>b.onclick=()=>{if(working)return;names.splice(Number(b.dataset.entryRemove),1);batch()});quick.querySelector('.workspace-entry-save').disabled=working||(!names.length&&!input.value.trim());};
  const paint=()=>{draft=input.value;active=-1;choices=QuickEntry.ranked(input.value,[...catalog,...state.custom],productEnglish).slice(0,4);options.innerHTML=choices.map((choice,i)=>'<button type="button" role="option" aria-selected="false" id="workspace-entry-option-'+i+'" data-entry-choice="'+i+'"><img src="'+(productArtwork[choice.item.name]||'assets/icons/oats.webp')+'" alt="" width="27" height="27"><span>'+esc(displayName(choice.item.name))+'</span>'+glyph('plus')+'</button>').join('');options.hidden=!choices.length;input.setAttribute('aria-expanded',String(!!choices.length));input.removeAttribute('aria-activedescendant');options.querySelectorAll('button').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>stage([choices[Number(b.dataset.entryChoice)].item.name],'')});batch();targetButtons();};
  const stage=(parts,remainder)=>{if(working)return;names=WorkspaceEntry.collect(parts,names,[...catalog,...state.custom],productEnglish,QuickEntry);input.value=remainder;paint();input.focus({preventScroll:true})};
  quick.querySelectorAll('[data-entry-target]').forEach(b=>b.onclick=()=>{if(!working){target=b.dataset.entryTarget;targetButtons()}});
  quick.querySelector('[data-entry-close]').onclick=()=>{if(!working)quick.close()};quick.oncancel=e=>{if(working)e.preventDefault()};
  quick.querySelector('form').onsubmit=e=>{e.preventDefault();stage(input.value.split(/[,;\n]/),'')};
  input.oninput=e=>{if(e.isComposing)return;const parts=input.value.split(/[,;\n]/);parts.length>1?stage(parts.slice(0,-1),parts.at(-1)):paint()};
  input.oncompositionend=()=>input.dispatchEvent(new Event('input'));
  input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'&&choices.length){e.preventDefault();options.hidden=true;choices=[];input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');return}if(['ArrowDown','ArrowUp'].includes(e.key)&&choices.length){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;options.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant','workspace-entry-option-'+active)}if(e.key==='Enter'){e.preventDefault();stage([active>=0?choices[active].item.name:input.value],'')}};
  quick.querySelector('.workspace-entry-save').onclick=async()=>{
   if(working)return;if(entryContext!==voiceContext()){quick.close();return}
   if(target==='stock'&&(household?.busy||household?.cartPending)||target==='cart'&&household?.active&&!household.cartInteractive){status.textContent=say('A szinkronizálás még tart. Egy pillanat, és folytathatod.','Still syncing. Please try again in a moment.');return}
   stage(input.value.split(/[,;\n]/),'');if(!names.length)return;
   const requested=[...names],destination=target,plan=WorkspaceEntry.plan(state,requested,destination,catalog,productUnit,QuickEntry.norm),ctx=entryContext;
   working=true;input.readOnly=true;quick.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='';
   try{const ok=destination==='cart'?(household?.active?household.editCart(plan.next,{onlyIfMissing:true}):commitState(plan.next)):await saveVoiceState(plan.next);if(!ok)throw Error('save');if(ctx!==voiceContext())return;
    if(destination==='stock')await window.PantryReview?.confirm(requested);else if(plan.changed.length)basketFeedback();
    names=[];draft='';quick.close();const y=scrollY;render();window.scrollTo(0,y);toast(plan.changed.length?say(destination==='stock'?'A készletbe került.':'A listára került.',destination==='stock'?'Added to pantry.':'Added to list.'):say('Már minden szerepel rajta.','Everything is already there.'));
   }catch{if(ctx===voiceContext())status.textContent=say('Nem sikerült menteni. A felvett tételek megmaradtak, próbáld újra.','Could not save. Your entries are kept; try again.');}
   finally{working=false;input.readOnly=false;if(quick.open){quick.querySelectorAll('button').forEach(b=>b.disabled=false);paint();}}
  };
  const position=()=>{const v=window.visualViewport;quick.style.bottom=Math.max(0,innerHeight-(v?.height||innerHeight)-(v?.offsetTop||0))+'px';quick.style.maxHeight=Math.max(150,(v?.height||innerHeight)-20)+'px'};
  quick.onclose=()=>{draft=input.value;window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position)};
  paint();if(!quick.open)quick.showModal();position();window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);input.focus({preventScroll:true});
 }
 function connectionNote(){let note=document.getElementById('workspace-connection-note');if(!note){note=document.createElement('div');note.id='workspace-connection-note';note.setAttribute('role','status');note.setAttribute('data-no-translate','');document.querySelector('.app header').after(note)}note.hidden=navigator.onLine!==false;note.textContent=say('Nincs internet. Az AI és a közös konyha frissítése szünetel.','No internet. AI and shared kitchen updates are unavailable.')}
 window.addEventListener('offline',connectionNote);window.addEventListener('online',connectionNote);connectionNote();
 window.addEventListener('resize',mount);
 mount();return {mount,quick:openEntry};
})();
