import {cloudImage,IMAGE_PROMPT_VERSION} from './handler.mjs';
import {submitFal,pollFal,FAL_MODEL} from './fal.mjs';
import {openaiImage,MODELS} from '../plus-assistant/openai.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export async function persistentImage(input,request,config,fetcher,headers){
 const reply=(status,value)=>Response.json(value,{status,headers});let lease,filter,artifactPath,artifactBucket,stage='lookup',generated=false,pollJob,reservedRequest,reservedUser;
 const service={apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'};
 const db=(path,body,method=body===undefined?'GET':'POST')=>fetcher(config.url+'/rest/v1/'+path,{method,headers:service,...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 try{
  if(!uuid(input.recipeId)||!config.serviceKey)throw Error('IMAGE_INVALID_INPUT');
  const authorization=request.headers.get('authorization'),userHeaders={apikey:config.publishableKey,...(authorization?{Authorization:authorization}:{})};
  const rowResponse=await fetcher(config.url+'/rest/v1/recipe_documents?id=eq.'+input.recipeId+'&select=id,owner_id,published,content',{headers:userHeaders,signal:AbortSignal.timeout(10000)});
  if(!rowResponse.ok)return reply(403,{error:'IMAGE_ACCESS_DENIED'});const row=(await rowResponse.json())[0];if(!row)return reply(403,{error:'IMAGE_ACCESS_DENIED'});
  const step=input.step??-1;if(!Number.isInteger(step)||step< -1||step>=row.content.steps.length)throw Error('IMAGE_INVALID_INPUT');
  filter='recipe_asset_jobs?recipe_id=eq.'+row.id+'&step=eq.'+step;
  const lookup=async()=>{const r=await db(filter+'&select=*');if(!r.ok)throw Error('IMAGE_SETUP_REQUIRED');return (await r.json())[0]};
  const ready=async job=>{
   if(!['recipe-catalog','recipe-images'].includes(job.bucket)||!job.asset_path)throw Error('IMAGE_UNAVAILABLE');
   if(job.bucket==='recipe-catalog'){if(!row.published||!job.asset_path.startsWith(row.id+'/'))throw Error('IMAGE_UNAVAILABLE');return reply(200,{status:'ready',canReplace:false,url:config.url+'/storage/v1/object/public/recipe-catalog/'+job.asset_path,expiresAt:Date.now()+86400000})}
   const r=await fetcher(config.url+'/storage/v1/object/sign/recipe-images/'+job.asset_path,{method:'POST',headers:service,body:JSON.stringify({expiresIn:1800}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('IMAGE_UNAVAILABLE');const data=await r.json();if(!data.signedURL?.startsWith('/object/sign/'))throw Error('IMAGE_UNAVAILABLE');return reply(200,{status:'ready',canReplace:!!row.owner_id,url:config.url+'/storage/v1'+data.signedURL,expiresAt:Date.now()+1700000});
  };
  const saveImage=async(img,token)=>{
   stage='upload';const bucket=row.published?'recipe-catalog':'recipe-images',path=row.id+'/'+step+'/'+token+'.'+img.ext;artifactPath=path;artifactBucket=bucket;
   const upload=await fetcher(config.url+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',headers:{...service,'Content-Type':img.type,'cache-control':'public, max-age=31536000, immutable'},body:img.bytes,signal:AbortSignal.timeout(15000)});
   if(!upload.ok&&upload.status!==409)throw Error('IMAGE_UNAVAILABLE');
   let thumbnailPath=null;if(row.published&&step===-1&&config.thumbnail){try{const thumb=await config.thumbnail(img.bytes);thumbnailPath=row.id+'/thumb/'+token+'.jpg';const saved=await fetcher(config.url+'/storage/v1/object/recipe-catalog/'+thumbnailPath,{method:'POST',headers:{...service,'Content-Type':'image/jpeg','cache-control':'public, max-age=31536000, immutable'},body:thumb,signal:AbortSignal.timeout(10000)});if(!saved.ok&&saved.status!==409)thumbnailPath=null}catch{thumbnailPath=null}}
   stage='save';const stored=await db(filter+'&lease=eq.'+token,{state:'ready',asset_path:path,thumbnail_path:thumbnailPath,bucket,updated_at:new Date().toISOString()},'PATCH');if(!stored.ok)throw Error('IMAGE_UNAVAILABLE');lease=null;return ready({asset_path:path,bucket});
  };
  let cached=await lookup();
  if(cached?.provider_request&&['pending','uncertain'].includes(cached.state)){
   stage='poll';pollJob=cached;const img=await pollFal(cached.provider_request,config,fetcher);if(!img)return reply(202,{status:'pending'});generated=true;lease=cached.lease;const result=await saveImage(img,lease);if(cached.provider_request.paidRequest)await db('morzsa_plus_requests?request_id=eq.'+cached.provider_request.paidRequest+'&user_id=eq.'+cached.provider_request.userId,{state:'complete',model:FAL_MODEL,usage:{images:1,estimatedCents:0.3}},'PATCH');return result;
  }
if(cached?.state==='uncertain'&&cached.asset_path){const object=await fetcher(config.url+'/storage/v1/object/authenticated/'+cached.bucket+'/'+cached.asset_path,{method:'HEAD',headers:service,signal:AbortSignal.timeout(10000)});if(object.ok){await db(filter,{state:'ready'},'PATCH');cached={...cached,state:'ready'}}}if(cached?.state==='ready'&&!input.regenerate)return ready(cached);
  if(!input.create)return reply(200,{status:cached?.state==='pending'?'pending':'missing'});
  if(!authorization?.startsWith('Bearer '))return reply(401,{error:'IMAGE_SIGN_IN_REQUIRED'});
  const auth=await fetcher(config.url+'/auth/v1/user',{headers:userHeaders,signal:AbortSignal.timeout(10000)});if(!auth.ok)return reply(401,{error:'IMAGE_SIGN_IN_REQUIRED'});const user=await auth.json();if(!uuid(user.id))return reply(401,{error:'IMAGE_SIGN_IN_REQUIRED'});
  if(input.regenerate){
   if(row.owner_id!==user.id||row.published)return reply(403,{error:'IMAGE_REFRESH_DENIED'});
   const refresh=await db('rpc/request_recipe_image_refresh',{rid:row.id,image_step:step,user_id:user.id});if(!refresh.ok)throw Error('IMAGE_SETUP_REQUIRED');if(!await refresh.json())return reply(202,{status:'pending'});cached=null;
  }
  const recipe={title:row.content.title,summary:row.content.summary,minutes:row.content.minutes,...(row.content.servings?{servings:row.content.servings}:{}),...(row.content.equipment?{equipment:row.content.equipment}:{}),ingredients:row.content.ingredients,steps:row.content.steps},image={recipe,step};
  // Adopt an existing personal cache object instead of paying to recreate it.
  if(row.owner_id===user.id&&!input.regenerate){
   const original={title:recipe.title,summary:recipe.summary,minutes:recipe.minutes,ingredients:recipe.ingredients,steps:recipe.steps};
   for(const model of [...new Set([config.imageModel||MODELS.image,config.model].filter(Boolean))])for(const v of [IMAGE_PROMPT_VERSION,2]){
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({v,model,recipe:original,step}))),key=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
    const legacy=await db('recipe_image_jobs?owner_id=eq.'+user.id+'&cache_key=eq.'+key+'&state=eq.ready&select=asset_path');if(!legacy.ok)continue;const old=(await legacy.json())[0];
    if(old?.asset_path?.startsWith(user.id+'/'+key+'/')){const registered=await db('recipe_asset_jobs',{recipe_id:row.id,step,state:'ready',asset_path:old.asset_path,bucket:'recipe-images',model});if(registered.ok)return ready({asset_path:old.asset_path,bucket:'recipe-images'});const raced=await lookup();if(raced?.state==='ready')return ready(raced)}
   }
  }

  const useFal=!config.generateImage&&(row.published?config.catalogueProvider==='fal':input.quality!=='free'&&config.plusImageProvider==='fal');
  const useOpenAI=!useFal&&(!!config.generateImage||!!config.openaiKey&&(row.published?config.catalogueProvider==='openai':input.quality!=='free'));
  const model=useFal?FAL_MODEL:useOpenAI?config.imageModel||MODELS.image:config.model;
  stage='claim';const response=await db('rpc/claim_recipe_asset',{rid:row.id,image_step:step,user_id:user.id,image_model:model});if(!response.ok)throw Error('IMAGE_SETUP_REQUIRED');const claim=await response.json();
  if(claim.status==='ready')return ready(await lookup());if(claim.status==='pending')return reply(202,{status:'pending'});if(claim.status==='uncertain')return reply(503,{error:'IMAGE_UNCERTAIN'});if(claim.status==='cooldown')return reply(429,{error:'IMAGE_COOLDOWN',retryAfter:60});if(claim.status==='limit')return reply(429,{error:'IMAGE_LIMIT'});if(claim.status!=='claimed')throw Error('IMAGE_UNAVAILABLE');lease=claim.lease;
  let img;stage='generate';
  if(useFal){
   let paidRequest=null;if(!row.published&&input.quality!=='free'){
    paidRequest=lease;const reserved=await db('rpc/reserve_morzsa_plus',{user_id:user.id,hid:input.householdId||null,request_id:paidRequest,kind:'image',reserve_cents:1});if(!reserved.ok)throw Error('PLUS_SETUP_REQUIRED');const quota=await reserved.json();if(quota.status!=='reserved')throw Error(quota.status==='limit'?'PLUS_LIMIT':'PLUS_ACCESS_REQUIRED');reservedRequest=paidRequest;reservedUser=user.id;
   }
   const handle=await submitFal(image,config,fetcher);if(paidRequest){handle.paidRequest=paidRequest;handle.userId=user.id;}
const saved=await db(filter+'&lease=eq.'+lease,{provider_request:handle,updated_at:new Date().toISOString()},'PATCH');if(!saved.ok)throw Error('IMAGE_UNAVAILABLE');lease=null;return reply(202,{status:'pending'});
  }
  if(config.generateImage){img=await config.generateImage(image);generated=true}
  else if(useOpenAI){
   const requestId=crypto.randomUUID();const reserved=await db('rpc/reserve_morzsa_plus',{user_id:user.id,hid:input.householdId||null,request_id:requestId,kind:'image',reserve_cents:25});if(!reserved.ok)throw Error('PLUS_SETUP_REQUIRED');const quota=await reserved.json();if(quota.status!=='reserved')throw Error(quota.status==='limit'?'PLUS_LIMIT':'PLUS_ACCESS_REQUIRED');
   try{img=await openaiImage(image,config,fetcher);generated=true;await db('morzsa_plus_requests?request_id=eq.'+requestId+'&user_id=eq.'+user.id,{state:'complete',model,usage:img.usage||{}},'PATCH')}catch(e){await db('morzsa_plus_requests?request_id=eq.'+requestId+'&user_id=eq.'+user.id,{state:'failed',model,usage:{}},'PATCH');throw e}
  }else{img=await cloudImage(image,config,fetcher);generated=true}
  return await saveImage(img,lease);
 }catch(e){
  // A transient polling/auth/storage error must keep the known request handle.
  // Only an explicit terminal provider failure allows the existing cooldown path.
  if(pollJob&&e.definite){await db(filter+'&lease=eq.'+pollJob.lease,{state:'failed',updated_at:new Date().toISOString()},'PATCH').catch(()=>{});if(pollJob.provider_request.paidRequest)await db('morzsa_plus_requests?request_id=eq.'+pollJob.provider_request.paidRequest+'&user_id=eq.'+pollJob.provider_request.userId,{state:'failed',model:FAL_MODEL,usage:{}},'PATCH').catch(()=>{})}
  if(reservedRequest&&e.definite)await db('morzsa_plus_requests?request_id=eq.'+reservedRequest+'&user_id=eq.'+reservedUser,{state:'failed',model:FAL_MODEL,usage:{}},'PATCH').catch(()=>{});
  if(lease)await db(filter+'&lease=eq.'+lease,{state:generated||['TimeoutError','AbortError','TypeError'].includes(e.name)||stage==='generate'&&!['IMAGE_PROVIDER_LIMIT','IMAGE_SETUP_REQUIRED','PLUS_LIMIT','PLUS_ACCESS_REQUIRED','PLUS_API_QUOTA'].includes(e.message)?'uncertain':'failed',...(artifactPath?{asset_path:artifactPath,bucket:artifactBucket}:{}),updated_at:new Date().toISOString()},'PATCH').catch(()=>{});
  const known=['IMAGE_INVALID_INPUT','IMAGE_UNCERTAIN','IMAGE_LIMIT','IMAGE_PROVIDER_LIMIT','IMAGE_SETUP_REQUIRED','PLUS_LIMIT','PLUS_SETUP_REQUIRED','PLUS_ACCESS_REQUIRED','PLUS_API_QUOTA'];const error=known.includes(e.message)?e.message:['TimeoutError','AbortError'].includes(e.name)?'IMAGE_TIMEOUT':'IMAGE_UNAVAILABLE';console.warn(JSON.stringify({event:'morzsa_persistent_image_error',stage,error}));return reply(error==='IMAGE_INVALID_INPUT'?400:['IMAGE_LIMIT','PLUS_LIMIT','IMAGE_PROVIDER_LIMIT'].includes(error)?429:503,{error});
 }
}
