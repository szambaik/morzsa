import {normalizeInput,bodyFor,validOutput} from '../voice-command/handler.mjs';
import {outputResponse} from '../voice-command/stream.mjs';
import {createHandler as imageHandler} from '../recipe-image/handler.mjs';
import {MODELS,openaiText,openaiImage} from './openai.mjs';
import {VOICE_SECONDS,createCall,hangup,realtimeSession} from './realtime.mjs';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
async function readBody(request){
 if(Number(request.headers.get('content-length'))>2100000)throw Error('VOICE_INVALID_INPUT');
 const reader=request.body?.getReader();if(!reader)throw Error('VOICE_INVALID_INPUT');let size=0,text='';const decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2100000)throw Error('VOICE_INVALID_INPUT');text+=decoder.decode(value,{stream:true})}return JSON.parse(text+decoder.decode())}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export function createHandler(config,fetcher=fetch){return async request=>{
 const origin=request.headers.get('origin')||'',headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'},reply=(status,data)=>Response.json(data,{status,headers});
 if(origin&&!(config.origins||[]).includes(origin))return reply(403,{error:'VOICE_ORIGIN_DENIED'});
 if(origin)headers['Access-Control-Allow-Origin']=origin;
 headers['Access-Control-Allow-Headers']='authorization,apikey,content-type,x-client-info';headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(request.method))return reply(405,{error:'VOICE_METHOD_NOT_ALLOWED'});
 const configured=!!(config.url&&config.publishableKey&&config.serviceKey&&config.openaiKey);
 const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return request.method==='GET'?reply(200,{configured,enabled:false,supportsImages:configured,supportsStreaming:true,textProvider:'openai'}):reply(401,{error:'VOICE_SIGN_IN_REQUIRED'});
 if(!configured)return reply(503,{error:'PLUS_SETUP_REQUIRED'});
 const dbHeaders={apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'};
 const db=(path,body,method='POST')=>fetcher(config.url+'/rest/v1/'+path,{method,headers:dbHeaders,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
 let id,user,reserved=false;
 const settle=async(state,model,usage={},cents)=>{if(!reserved)return;const r=await db('morzsa_plus_requests?request_id=eq.'+id+'&user_id=eq.'+user.id,{state,model,usage,...(Number.isInteger(cents)?{charged_cents:cents}:{})},'PATCH');if(!r.ok)throw Error('PLUS_SETUP_REQUIRED')};
 try{
  const result=await fetcher(config.url+'/auth/v1/user',{headers:{apikey:config.publishableKey,Authorization:auth},signal:AbortSignal.timeout(10000)});if(!result.ok)return reply(401,{error:'VOICE_SIGN_IN_REQUIRED'});user=await result.json();if(!uuid(user.id))return reply(401,{error:'VOICE_SIGN_IN_REQUIRED'});
  const input=request.method==='GET'?{householdId:new URL(request.url).searchParams.get('householdId')||null}:await readBody(request),hid=input.householdId??null;
  if(hid!==null&&!uuid(hid))throw Error('VOICE_INVALID_INPUT');
  const accessResponse=await db('rpc/morzsa_plus_access',{user_id:user.id,hid});if(!accessResponse.ok)throw Error('PLUS_SETUP_REQUIRED');const access=await accessResponse.json();
  if(request.method==='GET')return reply(200,{configured,enabled:access.enabled===true,remainingCents:access.remainingCents??0,supportsImages:true,supportsStreaming:true,textProvider:'openai',voiceSeconds:VOICE_SECONDS});
  if(!access.enabled)throw Error('PLUS_ACCESS_REQUIRED');
  id=input.requestId;if(!uuid(id))throw Error('VOICE_INVALID_INPUT');
  const reserve=async(kind,cents)=>{const r=await db('rpc/reserve_morzsa_plus',{user_id:user.id,hid,request_id:id,kind,reserve_cents:cents});if(!r.ok)throw Error('PLUS_SETUP_REQUIRED');const v=await r.json();if(v.status!=='reserved')throw Error(['duplicate','pending'].includes(v.status)?'PLUS_REQUEST_PENDING':v.status==='limit'?'PLUS_LIMIT':'PLUS_ACCESS_REQUIRED');reserved=true};
  if(input.task==='image'){
   // Existing private image cache and lease guard; a cache hit spends nothing.
   return await imageHandler({...config,model:config.imageModel||MODELS.image,generateImage:async image=>{await reserve('image',25);try{const img=await openaiImage(image,config,fetcher);await settle('complete',config.imageModel||MODELS.image,img.usage);return img}catch(e){await settle('failed',config.imageModel||MODELS.image).catch(()=>{});throw e}}},fetcher)(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(input)}));
  }
  if(input.task==='end'){
   const r=await db('morzsa_plus_requests?request_id=eq.'+id+'&user_id=eq.'+user.id+'&kind=eq.voice&select=call_id,scope',undefined,'GET');if(!r.ok)throw Error('PLUS_SETUP_REQUIRED');const row=(await r.json())[0];if(!row||row.scope!==access.scope)throw Error('PLUS_ACCESS_REQUIRED');await hangup(row.call_id,config,fetcher);reserved=true;await settle('complete',config.voiceModel||MODELS.voice);return reply(200,{ended:true});
  }
  if(input.task==='connect'){
   if(typeof input.sdp!=='string'||input.sdp.length>65000||!input.sdp.startsWith('v=0')||!config.watchCall||!config.defer)throw Error('VOICE_INVALID_INPUT');
   const clean=normalizeInput({...input,text:'Voice session',assistant:true,companion:true});await reserve('voice',30);
   const call=await createCall(input.sdp,clean,config,fetcher);
   try{const stored=await db('morzsa_plus_requests?request_id=eq.'+id+'&user_id=eq.'+user.id,{call_id:call.callId,expires_at:new Date(Date.now()+VOICE_SECONDS*1000).toISOString()},'PATCH');if(!stored.ok)throw Error('PLUS_SETUP_REQUIRED');
    config.defer(config.watchCall(call.callId,realtimeSession(clean,config),()=>hangup(call.callId,config,fetcher),()=>settle('complete',config.voiceModel||MODELS.voice)));
   }catch(e){await hangup(call.callId,config,fetcher).catch(()=>{});throw e}
   return reply(200,{sdp:call.sdp,seconds:VOICE_SECONDS,requestId:id});
  }
  if(input.task!=='chat'||input.audio)throw Error('VOICE_INVALID_INPUT');
  const clean=normalizeInput(input);await reserve('chat',12);
  const produce=async(onAnswer,signal)=>{try{const {output,usage}=await openaiText(bodyFor(clean),config,fetcher,onAnswer,signal);if(!validOutput(output))throw Error('VOICE_INVALID_RESPONSE');
   // Response-only compatibility with the older focused recipe discussion.
   if(clean.context?.recipe)output.operations=[];
   const model=config.textModel||MODELS.text,rates=model===MODELS.text?[1,5]:model==='gpt-6-luna'?[.1,.5]:null;
   const cents=rates&&Number.isFinite(usage.input_tokens)&&Number.isFinite(usage.output_tokens)?Math.max(1,Math.ceil((usage.input_tokens*rates[0]+usage.output_tokens*rates[1])/10000)):undefined;
   await settle('complete',model,usage,cents);return output;
  }catch(e){await settle('failed',config.textModel||MODELS.text).catch(()=>{});throw e}};
  if(clean.stream)return outputResponse(produce,headers);return reply(200,await produce(()=>{},request.signal));
 }catch(e){if(reserved)await settle('failed',config.textModel||MODELS.text).catch(()=>{});const known=['PLUS_API_QUOTA','PLUS_SETUP_REQUIRED','PLUS_ACCESS_REQUIRED','PLUS_LIMIT','PLUS_REQUEST_PENDING','VOICE_INVALID_INPUT','VOICE_PROVIDER_LIMIT','VOICE_PROVIDER_BUSY','VOICE_SETUP_REQUIRED','VOICE_INVALID_RESPONSE','VOICE_PROVIDER_ERROR'];const error=known.includes(e.message)?e.message:['TimeoutError','AbortError'].includes(e.name)?'VOICE_TIMEOUT':'VOICE_UNAVAILABLE';return reply(error==='VOICE_INVALID_INPUT'?400:error==='PLUS_ACCESS_REQUIRED'?403:['PLUS_API_QUOTA','PLUS_LIMIT','PLUS_REQUEST_PENDING','VOICE_PROVIDER_LIMIT'].includes(error)?429:503,{error})}
}}
