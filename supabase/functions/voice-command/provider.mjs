// Bounded failover within the same Google project. Never repeat a partial stream.
export async function generate(input,body,config,fetcher=fetch){
 const primary=config.model||'gemini-3.1-flash-lite',fallback=config.fallbackModel??'gemini-3.5-flash-lite';
 const models=[...new Set([primary,fallback].filter(Boolean))];
 if(models.some(m=>!/^[a-z0-9.-]+$/.test(m)))throw Error('VOICE_SETUP_REQUIRED');
 const signal=AbortSignal.timeout(30000);let last='VOICE_PROVIDER_ERROR';
 for(const model of models){
  let response;
  try{response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+model+(input.stream?':streamGenerateContent?alt=sse':':generateContent'),{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':config.geminiKey},body:JSON.stringify(body),signal})}
  catch(e){if(signal.aborted||e.name==='TimeoutError')throw Error('VOICE_TIMEOUT');throw e}
  if(response.ok)return response;
  // Status/model only: do not log prompts, photos, headers, or provider bodies.
  console.warn(JSON.stringify({event:'morzsa_provider_failure',model,status:response.status}));
  await response.body?.cancel();
  if(response.status===429)last='VOICE_PROVIDER_LIMIT';
  else if([500,502,503,504].includes(response.status))last='VOICE_PROVIDER_BUSY';
  else if(response.status===404)last='VOICE_SETUP_REQUIRED';
  else throw Error('VOICE_PROVIDER_ERROR');
 }
 throw Error(last);
}
