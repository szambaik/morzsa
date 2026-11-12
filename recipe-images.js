// Recipe images are fetched independently; no image state enters saved chat data.
window.RecipeImages=(()=>{
 const entries=new Map(),auto=new Set();let queue=Promise.resolve();
 const scope=()=>household?.userId()+'|'+(household?.active||'local');
 const key=(r,step)=>scope()+'|'+JSON.stringify({title:r.title,summary:r.summary,minutes:r.minutes,ingredients:r.ingredients.map(i=>({name:i.name,amount:i.amount})),steps:r.steps})+'|'+step;
 const say=(hu,en)=>language==='en'?en:hu;
 function enqueue(recipes){for(const r of recipes||[])auto.add(key(r,-1))}
 function mount(host,recipe,step=-1,options={}){
  if(!host||!household?.userId()||!household.recipeImage)return;
  const id=key(recipe,step);let entry=entries.get(id);if(!entry||entry.expiresAt&&entry.expiresAt<Date.now()){entry={status:'new'};entries.set(id,entry)}
  let autoAttempted=false;const live=()=>host.isConnected&&key(recipe,step)===id;
  const paint=()=>{
   if(!live()){entry.views?.delete(host);return}host.replaceChildren();host.className=[...new Set((host.className||'').split(/\s+/).filter(Boolean).concat('generated-recipe-image'))].join(' ');host.dataset.imageStatus=entry.status;
   // A cache-only lookup may finish after the cooking hero was mounted.
   if(entry.status==='missing'&&options.autoCreate&&!autoAttempted){autoAttempted=true;load(true);return}
   if(entry.status==='ready'){
    const img=document.createElement('img');img.src=entry.url;img.alt=recipe.title+' · '+say(step<0?'AI-illusztráció a recepthez':'AI-illusztráció a főzési lépéshez',step<0?'AI recipe illustration':'AI cooking step illustration');img.loading=options.hero?'eager':'lazy';if(options.hero)img.fetchPriority='high';img.width=640;img.height=480;
    img.onerror=()=>{entry.status='failed';paint()};const caption=document.createElement('small');caption.textContent=say('AI-illusztráció · Morzsa','AI illustration · Morzsa');host.append(img,caption);return;
   }
   if(options.cacheOnly)return;
   const b=document.createElement('button');b.type='button';b.className='small-button';b.disabled=entry.status==='loading';
   b.textContent=entry.status==='loading'?say('Kép készül…','Creating image…'):entry.status==='limit'?say('A mai képkeret elfogyott','Daily image allowance used'):entry.status==='failed'?say('Kép újrapróbálása','Retry image'):entry.status==='pending'?say('Kép állapotának frissítése','Refresh image status'):say(step<0?'Képet kérek a recepthez':'Mutasd képen',step<0?'Create recipe image':'Show this step');
   b.disabled ||= entry.status==='limit';b.onclick=()=>load(true);host.append(b);
  };
  entry.views??=new Map();entry.views.set(host,paint);
  const refresh=()=>{for(const draw of entry.views.values())draw()};
  async function load(create){
   autoAttempted ||= create;
   if(entry.status==='loading')return;entry.status='loading';refresh();
   const work=async()=>{
    if(key(recipe,step)!==id){entry.status='new';return}
    try{const r=await household.recipeImage({recipe,step,create});if(r.status==='ready'){
      const base=window.MORZSA_CLOUD?.url;if(typeof r.url!=='string'||!base||!r.url.startsWith(base+'/storage/v1/object/sign/'))throw Error('IMAGE_UNAVAILABLE');
      Object.assign(entry,{status:'ready',url:r.url,expiresAt:r.expiresAt});
     }else entry.status=r.status==='pending'?'pending':'missing';
    }catch(e){entry.status=e.message==='IMAGE_LIMIT'?'limit':'failed'}
    refresh();
   };
   queue=queue.then(work,work);await queue;
  }
  paint();
  if(entry.status==='new'){
   const observer=new IntersectionObserver(items=>{if(items.some(i=>i.isIntersecting)){observer.disconnect();const queued=auto.delete(id);load(!options.cacheOnly&&(queued||options.autoCreate===true))}},{rootMargin:'100px'});observer.observe(host);
  }
 }
 return {mount,enqueue};
})();
