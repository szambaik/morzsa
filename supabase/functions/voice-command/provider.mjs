// Two bounded attempts. A slow primary must leave time for the fallback.
export async function generate(input,body,config,fetcher=fetch){
 const primary=config.model||'gemini-3.1-flash-lite',fallback=config.fallbackModel??'gemini-3.5-flash-lite';
 const models=[...new Set([primary,fallback].filter(Boolean))];
 if(models.some(m=>!/^[a-z0-9.-]+$/.test(m)))throw Error('VOICE_SETUP_REQUIRED');
 const deadline=AbortSignal.timeout(config.totalTimeoutMs||30000);let last='VOICE_PROVIDER_ERROR';
 for(const [index,model] of models.entries()){
  const attempt=new AbortController(),signal=AbortSignal.any([deadline,attempt.signal]);
  const timer=index<models.length-1?setTimeout(()=>attempt.abort(),config.headerTimeoutMs||8000):null;
  const started=Date.now();let response;
  // Buffer the fallback: its SSE endpoint can return HTTP 200 then a 503 event.
  // This also avoids displaying a second partial answer after a failed attempt.
  const streaming=input.stream&&index===0;
  const payload=/^gemini-3[.-]/.test(model)?{...body,generationConfig:{...body.generationConfig,thinkingConfig:{thinkingLevel:'minimal'}}}:body;
  try{response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+model+(streaming?':streamGenerateContent?alt=sse':':generateContent'),{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':config.geminiKey},body:JSON.stringify(payload),signal})}
  catch(e){
   if(deadline.aborted)throw Error('VOICE_TIMEOUT');
   if(attempt.signal.aborted||e.name==='TimeoutError'||e.name==='AbortError'||e instanceof TypeError){last=attempt.signal.aborted||e.name==='TimeoutError'?'VOICE_TIMEOUT':'VOICE_UNAVAILABLE';console.warn(JSON.stringify({event:'morzsa_provider_wait',model,elapsedMs:Date.now()-started,error:last}));continue}
   throw e;
  }finally{if(timer)clearTimeout(timer)}
  if(response.ok){console.info(JSON.stringify({event:'morzsa_provider_ready',model,headersMs:Date.now()-started,streaming:!!streaming}));if(input.stream&&!streaming)return bufferedAsStream(response);return response}
  // Never log prompts, photos, headers or provider response bodies.
  console.warn(JSON.stringify({event:'morzsa_provider_failure',model,status:response.status}));
  await response.body?.cancel();
  if(response.status===429)last='VOICE_PROVIDER_LIMIT';
  else if([500,502,503,504].includes(response.status))last='VOICE_PROVIDER_BUSY';
  else if(response.status===404)last='VOICE_SETUP_REQUIRED';
  else throw Error('VOICE_PROVIDER_ERROR');
 }
 throw Error(last);
}

// Preserve the client streaming protocol while consuming a buffered fallback.
// Parsing and validation remain in stream.mjs/handler.mjs; no operations are
// exposed until the complete output passes the existing validator.
function bufferedAsStream(response){
 const encoder=new TextEncoder();
 return new Response(new ReadableStream({async start(controller){
  try{const data=await response.json();controller.enqueue(encoder.encode('data: '+JSON.stringify(data)+String.fromCharCode(10,10)));controller.close()}
  catch(error){controller.error(error)}
 }}),{headers:{'Content-Type':'text/event-stream'}});
}
