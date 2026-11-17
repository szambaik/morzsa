// fal queue handles survive edge/client timeouts. Never resubmit a known request.
import {imagePrompt} from './handler.mjs';
export const FAL_MODEL='fal-ai/flux-2/klein/4b';
const models={
 'fal-ai/flux-2/klein/4b':{base:'/fal-ai/flux-2',estimatedCents:0.5},
 'fal-ai/flux/schnell':{base:'/fal-ai/flux',estimatedCents:0.3}
};
export function falModel(config){const model=config.falModel||FAL_MODEL;if(!Object.hasOwn(models,model))throw Error('IMAGE_SETUP_REQUIRED');return model}
// Handles created before the Klein rollout have no model field. Keep polling them.
export function falJobModel(job){
 const model=job.model||'fal-ai/flux/schnell';
 if(!Object.hasOwn(models,model))throw Error('IMAGE_UNAVAILABLE');return model;
}
export const falEstimatedCents=job=>models[falJobModel(job)].estimatedCents;
const fail=(status,definite=false)=>Object.assign(Error(status===429?'IMAGE_PROVIDER_LIMIT':[401,403,404].includes(status)?'IMAGE_SETUP_REQUIRED':'IMAGE_UNAVAILABLE'),{definite});
function queueUrl(value,id,kind,model){
 const u=new URL(value),suffix='/requests/'+id+(kind==='status'?'/status':'');
 if(!/^[a-zA-Z0-9-]{8,100}$/.test(id)||u.origin!=='https://queue.fal.run'||u.username||u.password||u.search||u.hash||![models[model].base+suffix,'/'+model+suffix].includes(u.pathname))throw Error('IMAGE_UNAVAILABLE');
 return u.href;
}
export async function submitFal(input,config,fetcher=fetch){
 if(!config.falKey)throw Error('IMAGE_SETUP_REQUIRED');
 const model=falModel(config),prompt=await imagePrompt(input,config,fetcher);
 const endpoint='https://queue.fal.run/'+model+(config.webhookUrl?'?fal_webhook='+encodeURIComponent(config.webhookUrl):'');
 const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Key '+config.falKey,'Content-Type':'application/json'},body:JSON.stringify({prompt,image_size:{width:768,height:512},num_inference_steps:4,num_images:1,output_format:'jpeg',enable_safety_checker:true}),signal:AbortSignal.timeout(15000)});
 if(!response.ok){await response.body?.cancel();throw fail(response.status,response.status<500)}
 const data=await response.json(),id=data.request_id;if(typeof id!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(id))throw Error('IMAGE_UNAVAILABLE');
 return {id,model,...(config.webhookUrl?{webhook:true}:{}),statusUrl:queueUrl(data.status_url,id,'status',model),resultUrl:queueUrl(data.response_url,id,'result',model)};
}
export async function pollFal(job,config,fetcher=fetch){
 if(!config.falKey)throw Error('IMAGE_SETUP_REQUIRED');
 const model=falJobModel(job),statusUrl=queueUrl(job.statusUrl,job.id,'status',model),resultUrl=queueUrl(job.resultUrl,job.id,'result',model);
 const headers={Authorization:'Key '+config.falKey},status=await fetcher(statusUrl,{headers,signal:AbortSignal.timeout(10000)});
 if(!status.ok){await status.body?.cancel();throw fail(status.status)}const info=await status.json();
 if(['IN_QUEUE','IN_PROGRESS'].includes(info.status))return null;if(info.status!=='COMPLETED')throw Object.assign(Error('IMAGE_UNAVAILABLE'),{definite:['FAILED','ERROR','CANCELLED'].includes(info.status)});
 const result=await fetcher(resultUrl,{headers,signal:AbortSignal.timeout(10000)});
 if(!result.ok){await result.body?.cancel();throw fail(result.status,result.status===422)}const data=await result.json(),url=data.images?.[0]?.url;
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='fal.media'||u.hostname.endsWith('.fal.media')||u.hostname==='storage.googleapis.com'&&u.pathname.startsWith('/fal_cdn/')))throw Error('IMAGE_UNAVAILABLE');
 const image=await fetcher(u.href,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!image.ok||Number(image.headers.get('content-length'))>3000000)throw Error('IMAGE_UNAVAILABLE');
 const reader=image.body.getReader(),parts=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3000000)throw Error('IMAGE_UNAVAILABLE');parts.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 if(bytes[0]!==255||bytes[1]!==216)throw Error('IMAGE_UNAVAILABLE');return {bytes,type:'image/jpeg',ext:'jpg'};
}
