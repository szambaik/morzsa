import {partialAnswer,readGeminiStream} from './stream.mjs';
import {generate} from './provider.mjs';
export function groqBody(body,model){
 const history=body.contents.slice(0,-1).slice(-12).map(m=>({role:m.role==='model'?'assistant':'user',content:m.parts.map(p=>p.text||'').join('\n').slice(0,m.role==='user'?5000:3000)}));
 return {model,stream:true,reasoning_effort:'low',max_completion_tokens:3000,response_format:{type:'json_object'},messages:[{role:'system',content:body.systemInstruction.parts.map(p=>p.text).join('\n')+' IMPORTANT examples: Current message: Elfogyott a tej, tedd a listára. => operations MUST contain stock_remove Tej AND list_set Tej (both with null quantity/unit). Current message: Van még tej? => operations []. Current message: Vettem tojást. => stock_add Tojás. In answer NEVER say an operation is already done. Say Javaslom / Mentés után instead; the app has not saved anything. Echo current message in transcript. Return one JSON object, answer first. Follow this output schema: '+JSON.stringify(body.generationConfig.responseSchema)},...history,{role:'user',content:body.contents.at(-1).parts.map(p=>p.text||'').join('\n')}]};
}
async function readGroq(response,onAnswer,signal){
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',raw='',finish='',size=0;
 const cancel=()=>reader.cancel().catch(()=>{});signal.addEventListener('abort',cancel,{once:true});
 const event=line=>{if(!line.startsWith('data:'))return;const text=line.slice(5).trim();if(!text||text==='[DONE]')return;const data=JSON.parse(text);if(data.error)throw Error('VOICE_PROVIDER_BUSY');const c=data.choices?.[0];if(c?.finish_reason)finish=c.finish_reason;raw+=c?.delta?.content||'';if(raw.length>50000)throw Error('VOICE_INVALID_RESPONSE');onAnswer(partialAnswer(raw))};
 try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000)throw Error('VOICE_INVALID_RESPONSE');buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){event(buffer.slice(0,end));buffer=buffer.slice(end+1)}}signal.throwIfAborted();buffer+=decoder.decode();if(buffer.trim())event(buffer);if(finish!=='stop')throw Error('VOICE_INVALID_RESPONSE');return JSON.parse(raw)}
 finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export async function textOutput(input,body,config,fetcher,onAnswer,validate,signal){
 const started=Date.now(),deadline=AbortSignal.timeout(35000),overall=AbortSignal.any([deadline,...(signal?[signal]:[])]);
 const model=config.groqModel||'openai/gpt-oss-120b';if(!/^[a-zA-Z0-9/._-]+$/.test(model))throw Error('VOICE_SETUP_REQUIRED');
 try{
  const attempt=AbortSignal.any([overall,AbortSignal.timeout(config.groqTimeoutMs||12000)]);
  const r=await fetcher('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+config.groqKey,'Content-Type':'application/json'},body:JSON.stringify(groqBody(body,model)),signal:attempt});
  if(!r.ok){await r.body?.cancel();throw Error(r.status===429?'VOICE_PROVIDER_LIMIT':[500,502,503,504].includes(r.status)?'VOICE_PROVIDER_BUSY':[401,403,404].includes(r.status)?'VOICE_SETUP_REQUIRED':'VOICE_PROVIDER_ERROR')}
  const result=validate(await readGroq(r,onAnswer,attempt));console.info(JSON.stringify({event:'morzsa_text_done',provider:'groq',model,totalMs:Date.now()-started}));return result;
 }catch(e){
  if(overall.aborted)throw Error(signal?.aborted?'ABORTED':'VOICE_TIMEOUT');
  const error=['VOICE_PROVIDER_LIMIT','VOICE_PROVIDER_BUSY','VOICE_SETUP_REQUIRED','VOICE_PROVIDER_ERROR','VOICE_INVALID_RESPONSE'].includes(e.message)?e.message:'VOICE_UNAVAILABLE';
  console.warn(JSON.stringify({event:'morzsa_text_failover',provider:'groq',error}));
  if(!config.geminiKey)throw Error(error);
  onAnswer('');
  const response=await generate({...input,stream:true},body,{...config,fallbackModel:'',totalTimeoutMs:Math.max(1,35000-(Date.now()-started))},(url,options)=>fetcher(url,{...options,signal:AbortSignal.any([overall,options.signal])}));
  return validate(await readGeminiStream(response,onAnswer,overall));
 }
}
