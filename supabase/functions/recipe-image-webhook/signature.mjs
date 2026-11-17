// fal's signed raw-body protocol: https://fal.ai/docs/model-apis/model-endpoints/webhooks
const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
export function webhookVerifier(fetcher=fetch){
 let keys=[],expiresAt=0;
 return async(headers,body,now=Date.now())=>{
  const id=headers.get('x-fal-webhook-request-id'),user=headers.get('x-fal-webhook-user-id'),timestamp=headers.get('x-fal-webhook-timestamp'),signature=headers.get('x-fal-webhook-signature');
  if(!id||id.length>100||!user||user.length>200||!/^\d{10,11}$/.test(timestamp||'')||Math.abs(now/1000-Number(timestamp))>300||!/^([a-f0-9]{2}){64}$/i.test(signature||''))return false;
  if(!keys.length||now>=expiresAt){
   const response=await fetcher('https://rest.fal.ai/.well-known/jwks.json',{signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!response.ok)throw Error('WEBHOOK_KEYS_UNAVAILABLE');const jwks=await response.json();
   if(!Array.isArray(jwks.keys)||!jwks.keys.length||jwks.keys.length>20)throw Error('WEBHOOK_KEYS_UNAVAILABLE');
   keys=jwks.keys;expiresAt=now+3600000;
  }
  const digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',body)));
  const message=new TextEncoder().encode([id,user,timestamp,digest].join('\n'));
  const bytes=Uint8Array.from(signature.match(/../g),s=>parseInt(s,16));
  for(const jwk of keys){try{
   if(typeof jwk.x!=='string'||jwk.kty&&jwk.kty!=='OKP'||jwk.crv&&jwk.crv!=='Ed25519')continue;
   const publicKey=Uint8Array.from(atob(jwk.x.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const key=await crypto.subtle.importKey('raw',publicKey,'Ed25519',false,['verify']);
   if(await crypto.subtle.verify('Ed25519',key,bytes,message))return true;
  }catch{}}
  return false;
 };
}
