// The selected Kitchen Companion direction uses the existing household stores.
window.MorzsaWorkspace=(()=>{
 const say=(hu,en)=>language==='en'?en:hu;
 const glyph=name=>'<img class="workspace-icon" src="assets/ui/'+name+'.svg" alt="" aria-hidden="true">';
 const nav=document.querySelector('.app>nav'),mobileParent=nav.parentElement;
 const order=['overview','shopping','chat','pantry','recipes'];
 const navIcons={overview:'layout-grid',pantry:'house',shopping:'shopping-cart',recipes:'chef-hat'};
 const sidebar=document.createElement('aside');sidebar.id='workspace-sidebar';sidebar.hidden=true;sidebar.setAttribute('data-no-translate','');
 sidebar.innerHTML='<a class="workspace-brand" href="#">'+document.querySelector('header .brand').innerHTML+'</a><div class="workspace-navigation"></div><div class="workspace-history"></div>';
 const dashboard=e=>{e.preventDefault();page='overview';render();window.scrollTo(0,0)};sidebar.querySelector('a').onclick=dashboard;document.querySelector('header .brand').onclick=dashboard;document.body.append(sidebar);
 const settings=document.createElement('section');settings.className='workspace-settings-area';settings.setAttribute('data-no-translate','');
 settings.innerHTML='<details class="workspace-settings"><summary>'+glyph('sliders-horizontal')+'<span data-settings-label></span></summary><div class="workspace-account"></div><div class="workspace-language"><span data-language-label></span><div class="workspace-language-host"></div></div><label class="workspace-ai-mode"><span data-ai-mode-label></span><select id="workspace-ai-mode"><option value="plus">Morzsa Plus</option><option value="free"></option></select></label></details><button type="button" class="workspace-preferences" data-kitchen-preferences>'+glyph('heart')+'<span></span></button><button type="button" class="workspace-introduction">'+glyph('sparkles')+'<span></span></button>';
 const account=document.getElementById('household-button'),languageSwitch=document.querySelector('.language-switch');
 settings.querySelector('.workspace-account').append(account);settings.querySelector('.workspace-language-host').append(languageSwitch);
 languageSwitch.querySelector('[data-language=hu]').textContent='Magyar';languageSwitch.querySelector('[data-language=en]').textContent='English';
 settings.querySelector('.workspace-preferences').onclick=()=>{document.getElementById('companion-history')?.close();window.KitchenIntelligence?.openPreferences()};
 settings.querySelector('.workspace-introduction').onclick=()=>{document.getElementById('companion-history')?.close();window.MorzsaOnboarding?.open()};
 const aiMode=settings.querySelector('#workspace-ai-mode');
 function syncAIMode(){
  settings.querySelector('[data-ai-mode-label]').textContent=say('AI mód','AI mode');
  aiMode.querySelector('[value=free]').textContent=say('Ingyenes','Free');
  aiMode.value=window.AIMode?.get()||'plus';
  aiMode.disabled=!window.AIMode||window.MorzsaCompanion?.canChangeAIMode?.()===false;
 }
 aiMode.onchange=()=>{if(window.MorzsaCompanion?.canChangeAIMode?.()===false){syncAIMode();return}if(!window.AIMode?.set(aiMode.value))toast(say('A beállítást nem sikerült menteni.','Could not save this setting.'));syncAIMode()};
 settings.querySelector('.workspace-settings').addEventListener('toggle',syncAIMode);
 function attachSettings(host){
  const dialog=document.getElementById('companion-history');host=host||(matchMedia('(min-width:1000px)').matches?sidebar:dialog?.open?dialog:sidebar);
  if(settings.parentElement!==host)host.append(settings);
  syncAIMode();
  settings.querySelector('[data-settings-label]').textContent=say('Beállítások','Settings');settings.querySelector('[data-language-label]').textContent=say('Nyelv','Language');
  settings.querySelector('.workspace-preferences span').textContent=say('Főzési ízlésem','Cooking preferences');
  settings.querySelector('.workspace-introduction span').textContent=say('Morzsa bemutató','Morzsa introduction');languageSwitch.setAttribute('aria-label',say('Nyelv','Language'));
  languageSwitch.querySelectorAll('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language)));
 }
 const dock=document.createElement('section');dock.id='workspace-assistant';dock.hidden=true;dock.setAttribute('data-no-translate','');document.body.append(dock);
 let dockLanguage='',quick=null,names=[],draft='',target='stock',entryContext='',working=false;
 const ingredientsShortcut=()=>'<button type="button" data-workspace-ingredients>'+glyph('chef-hat')+say('Hozzávalók','Ingredients')+'</button>';
 const shoppingActions=()=>'<div class="workspace-fast-actions shopping-view-switch" role="group" aria-label="'+say('Vásárlási nézet','Shopping view')+'"><button type="button" data-start-shopping>'+glyph('shopping-cart')+'<span><strong>'+say('Boltban vagyok','I’m in the store')+'</strong><small>'+say('Nagy pipák, könnyű követés','Big checkmarks, easy tracking')+'</small></span></button></div>';
 const fastMarkup=()=>page==='shopping'&&!main.querySelector('.shopping-mode-screen')?shoppingActions():page==='overview'||page==='chat'||page==='pantry'||main.querySelector('.cooking-guide,.shopping-mode-screen')?'':'<div class="workspace-fast-actions" role="group" aria-label="'+say('Gyors műveletek','Quick actions')+'">'+(window.RecipeRoom?.reading()?ingredientsShortcut()+'<button data-workspace-recipe-chat>'+glyph('message-circle')+say('Morzsa','Morzsa')+'</button>':'')+(!['pantry','shopping'].includes(page)&&!window.RecipeRoom?.reading()?'<button type="button" data-workspace-add="stock">'+glyph('plus')+say('Hozzáadás','Quick add')+'</button>':'')+(page==='chat'?'<button type="button" data-workspace-new-chat aria-label="'+say('Új beszélgetés','New chat')+'">'+glyph('message-circle')+say('Új chat','New chat')+'</button>':'')+(page!=='chat'&&!window.RecipeRoom?.reading()?'<button class="workspace-context-assistant" type="button" data-workspace-assistant><img src="assets/brands/morzsa.svg" alt="" width="23" height="23">'+say('Kérdezz Morzsától','Ask Morzsa')+'</button>':'')+'</div>';
 function bindFast(host){host.querySelector('[data-start-shopping]')?.addEventListener('click',()=>window.ShoppingMode.start());host.querySelector('[data-workspace-recipe-chat]')?.addEventListener('click',()=>MorzsaCompanion.openRecipeChat(RecipeRoom.reading()));host.querySelector('[data-workspace-ingredients]')?.addEventListener('click',()=>{const r=RecipeRoom.reading(),context=voiceContext();if(r)RecipeIngredientsPanel.open(r,{portions:RecipeRoom.portionsFor(r),valid:()=>page==='recipes'&&RecipeRoom.reading()===r&&voiceContext()===context})});host.querySelector('[data-workspace-new-chat]')?.addEventListener('click',()=>window.MorzsaCompanion.newChat());host.querySelectorAll('[data-workspace-add]').forEach(b=>b.onclick=()=>openEntry(b.dataset.workspaceAdd));host.querySelector('[data-workspace-assistant]')?.addEventListener('click',()=>window.MorzsaCompanion.openContext(page))}
 function mountActivity(){
  main.querySelector('.activity-switcher')?.remove();
  let fresh=document.getElementById('workspace-new-chat');if(!fresh){fresh=document.createElement('button');fresh.id='workspace-new-chat';fresh.innerHTML=glyph('square-pen');fresh.onclick=()=>window.MorzsaCompanion.newChat();}const host=main.querySelector('.companion-compose-wrap,.room-compose-wrap')||dock;if(fresh.parentElement!==host)host.append(fresh);
  fresh.setAttribute('aria-label',say('Új Morzsa-beszélgetés','New Morzsa chat'));fresh.title=say('Új beszélgetés','New chat');fresh.hidden=!!main.querySelector('.cooking-guide,.cooking-preparation,.cooking-completion,.shopping-mode-screen');
 }
 function mount(){
  window.RecipeIngredientsPanel?.check();
  const desktop=matchMedia('(min-width:1000px)').matches,destinations=order;
  for(const [index,destination] of destinations.entries()){const button=nav.querySelector('[data-page="'+destination+'"]');if(nav.children[index]!==button)nav.insertBefore(button,nav.children[index]||null);const labels={overview:say('Áttekintés','Overview'),pantry:say('Készlet','Pantry'),chat:'Morzsa',shopping:say('Lista','List'),recipes:say('Receptek','Recipes')};for(const node of button.childNodes)if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim())node.textContent=labels[destination]+' ';const span=button.querySelector('span');if(navIcons[destination]&&!span.querySelector('.workspace-icon'))span.innerHTML=glyph(navIcons[destination]);}
  sidebar.hidden=!desktop;
  attachSettings();
  const navHost=desktop?sidebar.querySelector('.workspace-navigation'):mobileParent;if(nav.parentElement!==navHost)navHost.append(nav);
  const rail=document.getElementById('companion-history-rail');if(rail&&rail.parentElement!==sidebar.querySelector('.workspace-history'))sidebar.querySelector('.workspace-history').append(rail);
  const local=main.querySelector('.companion-compose-wrap,.room-compose-wrap,.shopping-mode-dock'),reading=page==='recipes'&&!!window.RecipeRoom?.reading();dock.hidden=!!local;dock.classList.toggle('workspace-quick-only',page!=='chat');
  if(local){let fast=local.querySelector('.workspace-fast-actions');if(!fast){local.insertAdjacentHTML('afterbegin',fastMarkup());bindFast(local);}}
  else if(!dock.querySelector('form')||dockLanguage!==language+'|'+page+'|'+reading){dockLanguage=language+'|'+page+'|'+reading;const value=dock.querySelector('input')?.value||'';dock.innerHTML=fastMarkup()+'<form class="workspace-composer"><input aria-label="'+say('Üzenet Morzsának','Message Morzsa')+'" placeholder="'+say('Kérdezz Morzsától…','Ask Morzsa…')+'" maxlength="2000"><button type="button" data-workspace-voice aria-label="'+say('Kérdezés hanggal','Ask by voice')+'">'+glyph('mic')+'</button><button type="submit" aria-label="'+say('Küldés','Send')+'">'+glyph('arrow-up')+'</button></form>';dock.querySelector('input').value=value;bindFast(dock);
   dock.querySelector('form').onsubmit=e=>{e.preventDefault();const input=dock.querySelector('input'),text=input.value.trim();const r=window.RecipeRoom?.reading();if(text&&(r?window.MorzsaCompanion.askRecipe(r,text,RecipeRoom.portionsFor(r)):window.MorzsaCompanion.ask(text))!==false)input.value=''};
   dock.querySelector('[data-workspace-voice]').onclick=()=>{const r=window.RecipeRoom?.reading();if(r&&window.MorzsaCompanion.discuss(r,RecipeRoom.portionsFor(r))===false)return;window.MorzsaCompanion.voice()};
  }
  document.body.classList.toggle('workspace-cooking',page==='chat'&&!!main.querySelector('.cooking-guide,.cooking-preparation,.cooking-completion'));document.body.classList.toggle('cooking-guided',page==='chat'&&!!main.querySelector('.cooking-guide[data-method-view=focus]'));if(page!=='chat')document.body.classList.remove('cooking-reading','cooking-stage-calm','workspace-crafting','craft-question-open');document.body.classList.toggle('workspace-chat',page==='chat');dock.dataset.context=page;document.body.classList.toggle('workspace-local-compose',!!local);
  document.documentElement.style.setProperty('--workspace-nav-height',desktop?'0px':nav.getBoundingClientRect().height+'px');
  if(quick?.open&&entryContext!==voiceContext())quick.close();
  window.MorzsaOnboarding?.mount();document.body.classList.toggle('introduction-active',!!main.querySelector('.morzsa-introduction'));
   window.MorzsaCompanion?.mountResume();window.KitchenIntelligence?.mount();window.WeeklyPlanUI?.mountEntry();mountActivity();mountKitchen();mountContext();window.MorzsaProactive?.mount();window.ShoppingMode?.positionFeedback();
 }
 function mountContext(){let panel=document.getElementById('workspace-context');const cart=state.cart.filter(i=>!i.done);if(!panel){panel=document.createElement('aside');panel.id='workspace-context';panel.setAttribute('data-no-translate','');document.body.append(panel)}panel.hidden=innerWidth<1340||page!=='chat'||!!main.querySelector('.cooking-guide,.cooking-preparation,.cooking-completion')||!cart.length;document.body.classList.toggle('workspace-has-context',!panel.hidden);if(panel.hidden)return;panel.innerHTML='<h2>'+say('A listád','Your list')+'</h2>'+cart.slice(0,5).map(i=>'<p><strong>'+esc(displayName(i.name))+'</strong><small>'+esc(cartAmount(i))+'</small></p>').join('')+'<button>'+say('Lista megnyitása','Open list')+' · '+cart.length+'</button>';panel.querySelector('button').onclick=()=>dashboardGo('shopping')}
 function mountKitchen(){document.getElementById('workspace-kitchen')?.remove()}
 function openEntry(destination,initialDraft){
  if(working)return;
  const nextContext=voiceContext();if(entryContext!==nextContext){names=[];draft='';entryContext=nextContext}target=destination;if(typeof initialDraft==='string')draft=initialDraft;
  if(!quick){quick=document.createElement('dialog');quick.id='workspace-entry';quick.setAttribute('data-no-translate','');document.body.append(quick);PanelGestures.bind(quick,{axis:'y',disabled:()=>working});}
  quick.setAttribute('aria-labelledby','quick-entry-title');quick.innerHTML='<div class="workspace-sheet-handle" aria-hidden="true"></div><div class="workspace-entry-head"><h2 id="quick-entry-title">'+say('Gyors felvétel','Quick add')+'</h2><button type="button" data-entry-close aria-label="'+say('Bezárás','Close')+'">'+glyph('x')+'</button></div><div class="workspace-entry-target" role="group" aria-label="'+say('Hová kerüljön?','Destination')+'"><button data-entry-target="stock">'+glyph('house')+say('Készletbe','To pantry')+'</button><button data-entry-target="cart">'+glyph('shopping-cart')+say('Listára','To list')+'</button></div><form><input role="combobox" aria-label="'+say('Termékek gyors felvétele','Quickly add products')+'" aria-autocomplete="list" aria-controls="workspace-entry-options" aria-expanded="false" placeholder="'+say('Tej, kenyér, alma…','Milk, bread, apples…')+'" autocomplete="off" enterkeyhint="done" maxlength="2000"></form><div id="workspace-entry-options" role="listbox"></div><div class="workspace-entry-batch"></div><p class="workspace-entry-hint">'+say('A + csak kiválaszt. A lent lévő gomb ment. Vesszővel több tételt írhatsz; mennyiség nem kötelező.','The + selects an item; the bottom button saves. Use commas for several items; quantities are optional.')+'</p><p class="workspace-entry-status" role="status"></p><button class="primary workspace-entry-save" type="button">'+glyph('plus')+say('Hozzáadom','Add')+'</button>';
  const input=quick.querySelector('input'),options=quick.querySelector('#workspace-entry-options'),status=quick.querySelector('.workspace-entry-status');input.value=draft;let choices=[],active=-1;
  const targetButtons=()=>quick.querySelectorAll('[data-entry-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.entryTarget===target)));
  const batch=()=>{quick.querySelector('.workspace-entry-save').textContent=input.value.trim()?say('Szöveg kiválasztása','Select typed items'):say('Kijelöltek mentése','Save selected')+' · '+names.length;quick.querySelector('.workspace-entry-batch').innerHTML=(names.length?'<strong>'+say('Kiválasztva','Selected')+' ('+names.length+')</strong>':'')+names.map((name,i)=>'<span class="workspace-entry-chip">'+esc(displayName(name))+'<button type="button" data-entry-remove="'+i+'" aria-label="'+esc(displayName(name))+': '+say('kivétel','remove')+'">'+glyph('x')+'</button></span>').join('');quick.querySelectorAll('[data-entry-remove]').forEach(b=>b.onclick=()=>{if(working)return;names.splice(Number(b.dataset.entryRemove),1);batch()});quick.querySelector('.workspace-entry-save').disabled=working||(!names.length&&!input.value.trim());};
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
   if(input.value.trim()){stage(input.value.split(/[,;\n]/),'');return}if(!names.length)return;
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
 mount();return {mount,quick:openEntry,attachSettings};
})();
