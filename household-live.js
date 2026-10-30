// Realtime is a wake-up signal only. RLS-protected reads and revision-checked writes
// remain the source of truth; the existing polling path stays as a fallback.
const HouseholdLive=(()=>{
 function changedNames(previous,next){
  const before=new Map(previous.map(r=>[r.bucket+':'+r.key,JSON.stringify(r.value)]));
  const after=new Map(next.map(r=>[r.bucket+':'+r.key,JSON.stringify(r.value)]));
  const names=[];
  for(const r of [...next,...previous])if(['stock','cart','custom'].includes(r.bucket)&&before.get(r.bucket+':'+r.key)!==after.get(r.bucket+':'+r.key)&&!names.includes(r.key))names.push(r.key);
  return names;
 }
 function connect({url,key,token,householdId,onChange,onReady=()=>{},WebSocketImpl=WebSocket,schedule=setTimeout,cancel=clearTimeout,repeat=setInterval,stopRepeat=clearInterval}){
  let stopped=false,socket=null,retry=null,pulse=null,attempt=0,ref=0,awaiting=null;
  const topic='realtime:morzsa:'+householdId;
  const send=(event,payload={},messageTopic=topic)=>{const id=String(++ref);if(socket?.readyState===1)socket.send(JSON.stringify({topic:messageTopic,event,payload,ref:id,join_ref:messageTopic===topic?'1':null}));return id};
  const dial=()=>{
   if(stopped)return;ref=0;awaiting=null;
   try{socket=new WebSocketImpl(url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(key)+'&vsn=1.0.0')}catch{reconnect();return}
   const current=socket;
   socket.onopen=()=>{if(stopped||socket!==current)return;send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{key:''},postgres_changes:[{event:'*',schema:'public',table:'household_records',filter:'household_id=eq.'+householdId}]},access_token:token});
    pulse=repeat(()=>{if(awaiting){current.close();return}awaiting=send('heartbeat',{},'phoenix')},20000);
   };
   socket.onmessage=e=>{if(stopped||socket!==current)return;let message;try{message=JSON.parse(e.data)}catch{return}
    if(message.event==='phx_reply'&&message.ref===awaiting)awaiting=null;
    if(message.topic!==topic)return;
    if(message.event==='phx_reply'&&message.ref==='1'&&message.payload?.status==='ok'){attempt=0;onReady()}
    if(message.event==='postgres_changes')onChange();
    if(message.event==='phx_error'||message.event==='phx_close'||message.event==='phx_reply'&&message.payload?.status==='error')current.close();
   };
   socket.onerror=()=>current.close();
   socket.onclose=()=>{if(socket!==current)return;stopRepeat(pulse);pulse=null;if(!stopped)reconnect()};
  };
  const reconnect=()=>{cancel(retry);retry=schedule(dial,Math.min(30000,1000*2**Math.min(attempt++,5)))};
  dial();return {updateToken(next){token=next;if(socket?.readyState===1)send('access_token',{access_token:token})},close(){stopped=true;cancel(retry);stopRepeat(pulse);socket?.close()}};
 }
 function describeChanges(previous,next){
  const old=new Map(previous.map(r=>[r.bucket+':'+r.key,JSON.stringify(r.value)]));
  return next.filter(r=>['stock','cart'].includes(r.bucket)&&old.get(r.bucket+':'+r.key)!==JSON.stringify(r.value)).map(r=>({name:r.key,kind:r.bucket==='stock'?(r.value>0?'home':'gone'):r.value===null?'unlisted':r.value.done?'bought':'listed'}));
 }
 return {connect,changedNames,describeChanges};
})();
if(typeof module!=='undefined')module.exports=HouseholdLive;
