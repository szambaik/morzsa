// A brief, optional introduction. It never creates stock or shopping items.
window.MorzsaOnboarding=(()=>{
 const key='morzsa-introduction-v1',say=(hu,en)=>language==='en'?en:hu;
 let active=false,step=0;const preview=new Set();
 try{active=!localStorage.getItem(key)&&!localStorage.getItem('morzsa-v2')&&!localStorage.getItem('morzsa-v1')&&!localStorage.getItem('morzsa-session');if(!active)localStorage.setItem(key,'seen')}catch{}
 const icon=n=>'<img class="workspace-icon" src="assets/ui/'+n+'.svg" alt="" width="22" height="22">';
 function finish(){active=false;try{localStorage.setItem(key,'seen')}catch{}render()}
 function mount(){
  if(!active||page!=='chat')return;
  const steps=[
   {title:say('Szia, én vagyok Morzsa.','Hi, I’m Morzsa.'),text:say('Segítek kitalálni, mit főzz, és megjegyezni, mi van otthon. Nem kell pontos nyilvántartást vezetned.','I help you decide what to cook and remember what’s at home. You don’t need exact records.'),example:say('„Mit főzzek ma?”','“What should I cook today?”'),icon:'message-circle'},
   {title:say('Mi van otthon?','What’s at home?'),text:say('Tej, tojás, liszt — ennyi is elég. A Készletbe gombbal gyorsan felveheted őket, mennyiség nélkül is.','Milk, eggs, flour — that’s enough. Use To pantry to add them quickly. Quantities are optional.'),example:say('„Van otthon tej és tojás.”','“We have milk and eggs.”'),icon:'house'},
   {title:say('Ami kell, mehet a listára.','What you need goes on the list.'),text:say('A Listára gombbal felírod, a boltban kipipálod. Ha elfogy valami, szólj Morzsának.','Use To list to add something, then check it off at the shop. Tell Morzsa when something runs out.'),example:say('„Elfogyott a tej, írd fel!”','“We ran out of milk, add it to the list!”'),icon:'shopping-cart'}
  ],current=steps[step];
  const demo=step===1?'<div class="introduction-demo"><small>'+say('Próbáld ki: mi van otthon?','Try it: what’s at home?')+'</small><div class="introduction-demo-grid">'+['Tej','Tojás'].map(n=>'<button data-intro-product="'+n+'" aria-pressed="'+preview.has(n)+'"><img src="'+productArtwork[n]+'" alt="" width="64" height="64"><strong>'+esc(displayName(n))+'</strong><span>'+say(preview.has(n)?'Otthon':'Otthonra jelölöm',preview.has(n)?'At home':'Mark at home')+'</span>'+icon(preview.has(n)?'check':'plus')+'</button>').join('')+'</div></div>':step===2?'<div class="introduction-demo"><small>'+say('Próbáld ki: ezt már megvettem','Try it: I bought this')+'</small><button class="introduction-list-example" data-intro-product="bread" aria-pressed="'+preview.has('bread')+'">'+icon(preview.has('bread')?'check':'shopping-cart')+'<img src="'+productArtwork['Kenyér']+'" alt="" width="40" height="40"><strong>'+say('Kenyér','Bread')+'</strong><span>'+say(preview.has('bread')?'Megvettem':'Kipipálom',preview.has('bread')?'Bought':'Check off')+'</span></button></div>':'';
  main.innerHTML='<section class="morzsa-introduction" data-step="'+step+'" data-no-translate aria-label="'+say('Morzsa bemutató','Morzsa introduction')+'"><div class="introduction-top"><span>'+say('Egy perc, és indulhatunk','One minute, then you’re ready')+'</span><button data-intro-skip>'+say('Kihagyom','Skip')+'</button></div><img class="introduction-mascot" src="assets/illustrations/morzsa-mascot.webp" alt="" width="110" height="110"><p class="workspace-eyebrow">'+(step+1)+' / 3</p><h1>'+current.title+'</h1><p>'+current.text+'</p><div class="introduction-example">'+icon(current.icon)+'<span>'+current.example+'</span></div>'+demo+'<p class="introduction-voice">'+icon('mic')+say('Írhatsz vagy beszélhetsz is.','You can type or speak.')+'</p><div class="introduction-footer"><div class="introduction-controls">'+(step?'<button data-intro-back>'+say('Vissza','Back')+'</button>':'')+'<button class="primary" data-intro-next>'+say(step===2?'Feltöltöm a készletet':'Tovább',step===2?'Add my pantry':'Next')+icon(step===2?'plus':'arrow-right')+'</button></div>'+(step===2?'<button class="introduction-look" data-intro-skip>'+say('Előbb körülnézek','Let me look around first')+'</button>':'')+'</div></section>';
  main.querySelectorAll('[data-intro-product]').forEach(b=>b.onclick=()=>{const n=b.dataset.introProduct;preview.has(n)?preview.delete(n):preview.add(n);mount();main.querySelector('[data-intro-product="'+n+'"]')?.focus({preventScroll:true})});
  main.querySelectorAll('[data-intro-skip]').forEach(b=>b.onclick=finish);
  main.querySelector('[data-intro-back]')?.addEventListener('click',()=>{step--;mount();focusHeading()});
  main.querySelector('[data-intro-next]').onclick=()=>{if(step<2){step++;mount();focusHeading()}else{finish();window.MorzsaWorkspace.quick('stock')}};
 }
 function focusHeading(){const heading=main.querySelector('h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});window.scrollTo(0,0)}
 function open(){step=0;active=true;page='chat';render();mount()}
 return {mount,open,isActive:()=>active};
})();
