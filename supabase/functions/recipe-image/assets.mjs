import {pollFal,falJobModel,falEstimatedCents} from './fal.mjs';

export function assetStore(config,fetcher=fetch){
 const headers={apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'};
 const db=(path,body,method=body===undefined?'GET':'POST',extra={})=>fetcher(config.url+'/rest/v1/'+path,{method,headers:{...headers,...extra},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 const filter=(rid,step)=>'recipe_asset_jobs?recipe_id=eq.'+rid+'&step=eq.'+step;
 async function lookup(rid,step){const r=await db(filter(rid,step)+'&select=*');if(!r.ok)throw Error('IMAGE_UNAVAILABLE');return (await r.json())[0]}
 async function settle(job,state){
  const handle=job.provider_request;if(!handle?.paidRequest)return;
  const r=await db('morzsa_plus_requests?request_id=eq.'+handle.paidRequest+'&user_id=eq.'+handle.userId,{state,model:falJobModel(handle),usage:state==='complete'?{images:1,estimatedCents:falEstimatedCents(handle)}:{}},'PATCH');
  if(!r.ok)throw Error('IMAGE_UNAVAILABLE');
 }
 async function save(row,job,img){
  const bucket=row.published?'recipe-catalog':'recipe-images',path=row.id+'/'+job.step+'/'+job.lease+'.'+img.ext;
  try{
   const upload=await fetcher(config.url+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',headers:{...headers,'Content-Type':img.type,'cache-control':'public, max-age=31536000, immutable'},body:img.bytes,signal:AbortSignal.timeout(15000)});
   if(!upload.ok&&upload.status!==409)throw Error('IMAGE_UNAVAILABLE');
   let thumbnailPath=null;
   if(row.published&&job.step===-1&&config.thumbnail){try{
    const thumb=await config.thumbnail(img.bytes),thumbPath=row.id+'/thumb/'+job.lease+'.jpg';
    const r=await fetcher(config.url+'/storage/v1/object/recipe-catalog/'+thumbPath,{method:'POST',headers:{...headers,'Content-Type':'image/jpeg','cache-control':'public, max-age=31536000, immutable'},body:thumb,signal:AbortSignal.timeout(10000)});
    if(r.ok||r.status===409)thumbnailPath=thumbPath;
   }catch{}}
   const patch={state:'ready',asset_path:path,thumbnail_path:thumbnailPath,bucket,updated_at:new Date().toISOString()};
   const stored=await db(filter(row.id,job.step)+'&lease=eq.'+job.lease+'&state=in.(pending,uncertain)',patch,'PATCH',{Prefer:'return=representation'});
   if(!stored.ok)throw Error('IMAGE_UNAVAILABLE');
   if((await stored.json())?.length)return {...job,...patch};
   // Polling and webhook delivery may finish together. They share the same object.
   const current=await lookup(row.id,job.step);
   if(current?.state==='ready'&&current.lease===job.lease)return current;
   throw Error('IMAGE_UNAVAILABLE');
  }catch(e){throw Object.assign(e,{assetPath:path,assetBucket:bucket})}
 }
 async function completeFal(row,job){
  if(job.state==='ready'){await settle(job,'complete');return job}
  if(!['pending','uncertain'].includes(job.state)||!job.provider_request)return job;
  try{
   const img=await pollFal(job.provider_request,config,fetcher);if(!img)return job;
   const ready=await save(row,job,img);await settle(ready,'complete');return ready;
  }catch(e){
   if(e.definite){
    const failed=await db(filter(row.id,job.step)+'&lease=eq.'+job.lease+'&state=in.(pending,uncertain)',{state:'failed',updated_at:new Date().toISOString()},'PATCH',{Prefer:'return=representation'});
    if(!failed.ok)throw Error('IMAGE_UNAVAILABLE');
    if((await failed.json())?.length)await settle(job,'failed');
   }
   throw e;
  }
 }
 return {db,lookup,save,completeFal,settle};
}

// The signed webhook is the durable completion path. This short worker also
// finishes older handles and keeps ordinary requests fast when the app closes.
const backgroundJobs=new Set();
export function finishInBackground(row,job,config,fetcher=fetch){
 if(!config.defer||!job.provider_request)return;
 const key=config.url+'|'+row.id+'|'+job.step+'|'+job.lease;if(backgroundJobs.has(key))return;backgroundJobs.add(key);
 config.defer((async()=>{
  const store=assetStore(config,fetcher),started=Date.now();
  for(let attempt=0;Date.now()-started<60000;attempt++){
   await new Promise(resolve=>setTimeout(resolve,attempt<4?750:2500));
   try{
    const current=await store.lookup(row.id,job.step);
    if(!current||current.lease!==job.lease)return;
    const result=await store.completeFal(row,current);
    if(!['pending','uncertain'].includes(result.state))return;
   }catch(e){if(e.definite)return}
  }
 })().catch(()=>console.warn(JSON.stringify({event:'morzsa_image_background_error'}))).finally(()=>backgroundJobs.delete(key)));
}
