import {webhookVerifier} from './signature.mjs';
import {assetStore} from '../recipe-image/assets.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export function createHandler(config,fetcher=fetch){
 const verify=webhookVerifier(fetcher),store=assetStore(config,fetcher);
 return async request=>{
  const reply=(status,error)=>Response.json(error?{error}:{ok:true},{status});
  if(request.method!=='POST')return reply(405,'WEBHOOK_METHOD_NOT_ALLOWED');
  if(!config.url||!config.serviceKey||!config.falKey)return reply(503,'WEBHOOK_SETUP_REQUIRED');
  try{
   if(Number(request.headers.get('content-length'))>262144)return reply(413,'WEBHOOK_TOO_LARGE');
   const reader=request.body?.getReader();if(!reader)return reply(400,'WEBHOOK_INVALID');
   const parts=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)return reply(413,'WEBHOOK_TOO_LARGE');parts.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
   const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
   if(!await verify(request.headers,bytes))return reply(401,'WEBHOOK_SIGNATURE_INVALID');
   let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{return reply(400,'WEBHOOK_INVALID')}
   const id=body.request_id,headerId=request.headers.get('x-fal-webhook-request-id');
   if(typeof id!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(id)||![id,body.gateway_request_id].includes(headerId))return reply(400,'WEBHOOK_INVALID');
   const response=await store.db('recipe_asset_jobs?provider_request->>id=eq.'+encodeURIComponent(id)+'&select=*&limit=2');
   if(!response.ok)throw Error('IMAGE_UNAVAILABLE');const jobs=await response.json();
   // Completion can reach us before the submit response is persisted. Ask fal to retry.
   if(jobs.length!==1)return reply(503,'WEBHOOK_JOB_PENDING');const job=jobs[0];
   if(!uuid(job.recipe_id)||!uuid(job.lease)||job.provider_request?.id!==id)return reply(400,'WEBHOOK_INVALID');
   if(job.state==='failed'){await store.settle(job,'failed');return reply(200)}
   const recipeResponse=await store.db('recipe_documents?id=eq.'+job.recipe_id+'&select=id,published,content');
   if(!recipeResponse.ok)throw Error('IMAGE_UNAVAILABLE');const row=(await recipeResponse.json())[0];
   if(!row)return reply(200); // Deleted recipes must never be recreated by a callback.
   if(!Number.isInteger(job.step)||job.step< -1||job.step>=row.content.steps.length)return reply(400,'WEBHOOK_INVALID');
   try{
    // Retrieve using our stored handle, never download a URL supplied by the callback.
    const result=await store.completeFal(row,job);
    return ['ready','failed'].includes(result.state)?reply(200):reply(503,'WEBHOOK_JOB_PENDING');
   }catch(e){if(e.definite){const current=await store.lookup(row.id,job.step);if(current?.lease===job.lease&&current.state==='failed'){await store.settle(current,'failed');return reply(200)}}throw e}
  }catch{
   console.warn(JSON.stringify({event:'morzsa_image_webhook_retry'}));return reply(503,'WEBHOOK_RETRY');
  }
 };
}
