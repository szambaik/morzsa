// Private SQL cache. A missing migration, timeout, or storage failure must never
// discard an answer or add more than a small bounded delay to inference.
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
export async function cacheDigest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')}
export async function resultCache(config,fetcher,{userId,householdId=null,type,model,input,signal}){
 if(config.resultCacheEnabled!==true)return {payload:null,put:async()=>false};
 const clean={...input};delete clean.stream;delete clean.requestId;
 const hash=await cacheDigest(clean),args={p_user_id:userId,p_hid:householdId,p_request_type:type,p_input_hash:hash,p_model_key:model};
 const rpc=async(name,body)=>{signal?.throwIfAborted();const response=await fetcher(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([AbortSignal.timeout(1500),...(signal?[signal]:[])])});if(!response.ok)return null;return response.json()};
 let hit=null;const started=Date.now();try{hit=await rpc('get_morzsa_result_cache',args)}catch{}
 console.info(JSON.stringify({event:'morzsa_result_cache',type,hit:!!hit?.payload,lookupMs:Date.now()-started,available:!!hit}));
 return {payload:hit?.payload||null,version:hit?.version,put:async(payload,ttl=300)=>{if(!hit||signal?.aborted)return false;try{return await rpc('put_morzsa_result_cache',{...args,p_data_version:hit.version,p_payload:payload,p_ttl_seconds:ttl})===true}catch{return false}}};
}
