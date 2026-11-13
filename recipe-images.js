// Recipe images are fetched independently; no image state enters saved chat data.
window.RecipeImages=(()=>{
 const entries=new Map(),auto=new Set(),autoCreated=new Set();let queue=Promise.resolve();
 const scope=()=>household?.userId()+'|'+(household?.active||'local');
 const key=(r,step)=>scope()+'|'+JSON.stringify({title:r.title,summary:r.summary,minutes:r.minutes,ingredients:r.ingredients.map(i=>({name:i.name,amount:i.amount})),steps:r.steps})+'|'+step;
 const say=(hu,en)=>language==='en'?en:hu;
 const errors={
  IMAGE_TIMEOUT:['A kép lekérése túl sokáig tartott. Próbáld újra.','The image request timed out. Try again.'],
  IMAGE_SETUP_REQUIRED:['A képszolgáltatás beállítását ellenőrizni kell.','The image service configuration needs checking.'],
  IMAGE_SIGN_IN_REQUIRED:['A képhez jelentkezz be újra.','Sign in again to load the image.'],
  IMAGE_PROVIDER_LIMIT:['A képszolgáltatás most túlterhelt. Várj egy percet.','The image service is busy. Wait a minute.'],
  IMAGE_COOLDOWN:['Várj egy percet az újrapróbálás előtt.','Wait a minute before retrying.'],
  IMAGE_LOAD_FAILED:['A kész kép nem töltődött be. Frissítsd a kép linkjét.','The image could not load. Refresh its link.'],
  IMAGE_UNAVAILABLE:['A kép most nem elérhető. Próbáld újra később.','The image is unavailable. Try again later.']
 };
 function enqueue(recipes){for(const r of recipes||[])auto.add(key(r,-1))}
 function mount(host,recipe,step=-1,options={}){
  if(!host||!household?.userId()||!household.recipeImage)return;
  const id=key(recipe,step);let entry=entries.get(id);if(!entry||entry.expiresAt&&entry.expiresAt<Date.now()){entry={status:'new'};entries.set(id,entry)}
  let autoAttempted=false;const live=()=>host.isConnected&&key(recipe,step)===id;
  const paint=()=>{
   if(!live()){entry.views?.delete(host);return}host.replaceChildren();host.className=[...new Set((host.className||'').split(/\s+/).filter(Boolean).concat('generated-recipe-image'))].join(' ');host.dataset.imageStatus=entry.status;
   // A cache-only lookup may finish after the cooking hero was mounted.
   if(entry.status==='missing'&&options.autoCreate&&!autoAttempted&&!autoCreated.has(id)){autoAttempted=true;autoCreated.add(id);load(true);return}
   if(entry.status==='ready'){
    const img=document.createElement('img');img.src=entry.url;img.alt=recipe.title+' · '+say(step<0?'AI-illusztráció a recepthez':'AI-illusztráció a főzési lépéshez',step<0?'AI recipe illustration':'AI cooking step illustration');img.loading=options.hero?'eager':'lazy';if(options.hero)img.fetchPriority='high';img.width=640;img.height=480;
    img.onerror=()=>{if(entry.status!=='ready'||entry.url!==img.src)return;entry.status='failed';entry.error='IMAGE_LOAD_FAILED';refresh()};const caption=document.createElement('small');caption.textContent=say('AI-illusztráció · Morzsa','AI illustration · Morzsa');host.append(img,caption);return;
   }
   if(options.cacheOnly)return;
   const b=document.createElement('button');b.type='button';b.className='small-button';b.disabled=entry.status==='loading';
   b.textContent=entry.status==='loading'?say('Kép készül…','Creating image…'):entry.status==='limit'?say('A mai képkeret elfogyott','Daily image allowance used'):entry.status==='failed'?say('Kép újrapróbálása','Retry image'):entry.status==='pending'?say('Kép állapotának frissítése','Refresh image status'):say(step<0?'Képet kérek a recepthez':'Mutasd képen',step<0?'Create recipe image':'Show this step');
   const waiting=entry.retryAt>Date.now();
   b.disabled ||= entry.status==='limit'||waiting;
   if(waiting)b.textContent=say('Újrapróbálás egy perc múlva','Retry in a minute');
   if(entry.error==='IMAGE_SIGN_IN_REQUIRED'){b.disabled=false;b.textContent=say('Belépés','Sign in');b.onclick=()=>document.getElementById('household-button')?.click()}
   else b.onclick=()=>load(entry.error!=='IMAGE_LOAD_FAILED');host.append(b);
   if(entry.status==='failed'){const hint=document.createElement('small');hint.setAttribute?.('role','status');hint.textContent=say(...(errors[entry.error]||errors.IMAGE_UNAVAILABLE));host.append(hint)}
  };
  entry.views??=new Map();entry.views.set(host,paint);
  const refresh=()=>{for(const draw of entry.views.values())draw()};
  async function load(create){
   autoAttempted ||= create;
   if(entry.status==='loading'||entry.retryAt>Date.now())return;entry.status='loading';delete entry.error;refresh();
   const work=async()=>{
    if(key(recipe,step)!==id){entry.status='new';return}
    try{const r=await household.recipeImage({recipe,step,create});if(r.status==='ready'){
      const base=window.MORZSA_CLOUD?.url;if(typeof r.url!=='string'||!base||!r.url.startsWith(base+'/storage/v1/object/sign/'))throw Error('IMAGE_UNAVAILABLE');
      Object.assign(entry,{status:'ready',url:r.url,expiresAt:r.expiresAt});
     }else entry.status=r.status==='pending'?'pending':'missing';
    }catch(e){entry.error=Object.hasOwn(errors,e.message)||e.message==='IMAGE_LIMIT'?e.message:e.httpStatus===401?'IMAGE_SIGN_IN_REQUIRED':['AbortError','TimeoutError'].includes(e.name)?'IMAGE_TIMEOUT':'IMAGE_UNAVAILABLE';entry.status=entry.error==='IMAGE_LIMIT'?'limit':'failed';
     if(['IMAGE_COOLDOWN','IMAGE_PROVIDER_LIMIT'].includes(entry.error)){const seconds=Math.min(300,Math.max(1,Number(e.retryAfter)||60));entry.retryAt=Date.now()+seconds*1000;setTimeout(()=>{delete entry.retryAt;refresh()},seconds*1000)}
    }
    refresh();
   };
   queue=queue.then(work,work);await queue;
  }
  paint();
  if(entry.status==='new'){
   const observer=new IntersectionObserver(items=>{if(items.some(i=>i.isIntersecting)){observer.disconnect();if(!live()||entry.views.get(host)!==paint)return;const queued=auto.delete(id),create=!options.cacheOnly&&(queued||options.autoCreate===true)&&!autoCreated.has(id);if(create)autoCreated.add(id);load(create)}},{rootMargin:'100px'});observer.observe(host);
  }
 }
 async function cachedCover(recipe){
  const id=key(recipe,-1),entry=entries.get(id);if(entry?.status!=='ready'||entry.expiresAt<Date.now())return '';
  const response=await fetch(entry.url,{signal:AbortSignal.timeout(4000)});
  if(!response.ok||Number(response.headers.get('content-length'))>3000000)return '';
  const blob=await response.blob();if(blob.size>3000000||!['image/png','image/jpeg','image/webp'].includes(blob.type)||key(recipe,-1)!==id)return '';
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
 }
 return {mount,enqueue,cachedCover};
})();
