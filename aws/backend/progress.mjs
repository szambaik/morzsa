// Coalesce provider deltas; never queue one DynamoDB write per recipe token.
export function createProgressWriter(publish,interval=250){
 let progress={},last=0,chain=Promise.resolve(),timer=null,dirty=false;
 const send=()=>{
  clearTimeout(timer);timer=null;if(!dirty)return;dirty=false;last=Date.now();
  const snapshot=structuredClone(progress);
  chain=chain.then(()=>publish(snapshot)).catch(()=>{});
 };
 const update=value=>{
  progress={...progress,...value};dirty=true;
  const delay=interval-(Date.now()-last);
  if(delay<=0)send();else if(timer===null)timer=setTimeout(send,delay);
 };
 return {
  answer:text=>update({answer:text.slice(0,5000)}),
  recipes:list=>update({recipes:list.map(({title,summary,minutes,servings})=>({title,...(summary?{summary}:{}),...(minutes?{minutes}:{}),...(servings?{servings}:{})}))}),
  flush:()=>{send();return chain}
 };
}
