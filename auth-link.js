// Supabase's default email links return an implicit session in the URL fragment.
// Consume and remove credentials before doing any asynchronous work.
const AuthLink={
 consume(href){
  const url=new URL(href),fragment=new URLSearchParams(url.hash.slice(1));
  const keys=['access_token','refresh_token','token_type','expires_in','expires_at','type','error','error_code','error_description','provider_token','provider_refresh_token'];
  const present=['access_token','refresh_token','error','error_code'].some(k=>fragment.has(k)||url.searchParams.has(k));
  if(!present)return null;
  const get=k=>fragment.get(k)||url.searchParams.get(k);
  const access=get('access_token'),refresh=get('refresh_token'),type=get('type');
  const error=!!(get('error')||get('error_code'));
  const expiry=Number(get('expires_in'));
  for(const key of keys){fragment.delete(key);url.searchParams.delete(key)}
  url.hash=fragment.toString();
  return {cleanURL:url.href,error:error||!access||!refresh||!!(type&&!['magiclink','signup','invite'].includes(type)),access,refresh,expiresIn:Number.isFinite(expiry)&&expiry>0?Math.min(expiry,86400):3600};
 },
 async validate(link,config,fetcher=fetch){
  if(link.error)throw Error('invalid-link');
  const response=await fetcher(config.url+'/auth/v1/user',{headers:{apikey:config.publishableKey,Authorization:'Bearer '+link.access},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('invalid-link');
  const user=await response.json();if(!user?.id)throw Error('invalid-link');
  return {access_token:link.access,refresh_token:link.refresh,token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+link.expiresIn,user};
 }
};
if(typeof module!=='undefined')module.exports=AuthLink;
