// Only the first top-level answer string is previewed. Operations are never streamed.
export function partialAnswer(raw){
 const match=/^\s*\{\s*"answer"\s*:\s*"/.exec(raw);if(!match)return '';
 let result='';
 for(let i=match[0].length;i<raw.length;i++){
  const c=raw[i];if(c==='"')break;
  if(c!=='\\'){result+=c;continue}
  const next=raw[++i];if(next===undefined)break;
  if(next==='u'){const hex=raw.slice(i+1,i+5);if(!/^[0-9a-f]{4}$/i.test(hex))break;result+=String.fromCharCode(parseInt(hex,16));i+=4}
  else{const escaped={'"':'"','\\':'\\','/':'/','n':'\n','r':'\r','t':'\t','b':'\b','f':'\f'};if(!(next in escaped))break;result+=escaped[next]}
 }
 // Do not render a dangling UTF-16 surrogate between network chunks.
 return result.replace(/[\uD800-\uDBFF]$/,'').slice(0,5000);
}
export async function readGeminiStream(response,onAnswer,signal){
 const reader=response.body?.getReader();if(!reader)throw Error('VOICE_INVALID_RESPONSE');
 const cancel=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
 const decoder=new TextDecoder();let buffer='',raw='',finish='',last='',total=0,completed=false;
 const consume=event=>{
  const text=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!text||text==='[DONE]')return;
  const data=JSON.parse(text);if(data.error){const code=Number(data.error.code),status=['INVALID_ARGUMENT','UNAUTHENTICATED','PERMISSION_DENIED','RESOURCE_EXHAUSTED','INTERNAL','UNAVAILABLE','DEADLINE_EXCEEDED'].includes(data.error.status)?data.error.status:'UNKNOWN';console.warn(JSON.stringify({event:'morzsa_stream_provider_failure',code:Number.isInteger(code)?code:null,status}));throw Error(code===429?'VOICE_PROVIDER_LIMIT':[500,502,503,504].includes(code)?'VOICE_PROVIDER_BUSY':'VOICE_PROVIDER_ERROR')}const candidate=data.candidates?.[0];
  if(candidate?.finishReason)finish=candidate.finishReason;
  raw+=(candidate?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');if(raw.length>50000)throw Error('VOICE_INVALID_RESPONSE');
  const answer=partialAnswer(raw);if(answer!==last){last=answer;onAnswer(answer)}
 };
 try{
  while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>1000000)throw Error('VOICE_INVALID_RESPONSE');buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let end;while((end=buffer.indexOf('\n\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+2)}}
  buffer+=decoder.decode();if(buffer.trim())consume(buffer);if(finish!=='STOP')throw Error('VOICE_INVALID_RESPONSE');const result=JSON.parse(raw);completed=true;return result;
 }finally{signal?.removeEventListener('abort',cancel);if(!completed)await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export function streamedResponse(response,headers,validate){
 const encoder=new TextEncoder(),abort=new AbortController(),started=Date.now();let cancelled=false,first=null;
 const body=new ReadableStream({async start(controller){
  const send=event=>{if(!cancelled)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'))};
  try{const output=await readGeminiStream(response,text=>{first??=Date.now()-started;send({type:'answer',text})},abort.signal);send({type:'done',output:validate(output)});console.info(JSON.stringify({event:'morzsa_stream_done',firstAnswerMs:first,totalMs:Date.now()-started}))}
  catch(e){const error=['TimeoutError','AbortError'].includes(e.name)?'VOICE_TIMEOUT':['VOICE_INVALID_RESPONSE','VOICE_PROVIDER_ERROR','VOICE_PROVIDER_LIMIT','VOICE_PROVIDER_BUSY'].includes(e.message)?e.message:'VOICE_UNAVAILABLE';console.warn(JSON.stringify({event:'morzsa_stream_error',error,firstAnswerMs:first,totalMs:Date.now()-started}));send({type:'error',error})}
  finally{if(!cancelled)controller.close()}
 },cancel(){cancelled=true;abort.abort();}});
 return new Response(body,{headers:{...headers,'Content-Type':'application/x-ndjson','X-Accel-Buffering':'no'}});
}

export function outputResponse(produce,headers){
 const encoder=new TextEncoder(),abort=new AbortController();let cancelled=false;
 const body=new ReadableStream({async start(c){
  const send=v=>{if(!cancelled)c.enqueue(encoder.encode(JSON.stringify(v)+'\n'))};
  try{const output=await produce(text=>send({type:'answer',text}),abort.signal);if(!abort.signal.aborted)send({type:'done',output})}
  catch(e){const error=['VOICE_PROVIDER_LIMIT','VOICE_PROVIDER_BUSY','VOICE_SETUP_REQUIRED','VOICE_PROVIDER_ERROR','VOICE_INVALID_RESPONSE','VOICE_TIMEOUT'].includes(e.message)?e.message:['TimeoutError','AbortError'].includes(e.name)?'VOICE_TIMEOUT':'VOICE_UNAVAILABLE';send({type:'error',error})}
  finally{if(!cancelled)c.close()}
 },cancel(){cancelled=true;abort.abort()}});
 return new Response(body,{headers:{...headers,'Content-Type':'application/x-ndjson','X-Accel-Buffering':'no'}});
}
