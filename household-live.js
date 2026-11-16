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
 function connect({url,key,token,householdId,onChange,onReady=()=>{},extraTables=[],WebSocketImpl=WebSocket,schedule=setTimeout,cancel=clearTimeout,repeat=setInterval,stopRepeat=clearInterval}){
  let joined=false,stopped=false,socket=null,retry=null,pulse=null,attempt=0,ref=0,awaiting=null;
  const topic='realtime:morzsa:'+householdId;
  const send=(event,payload={},messageTopic=topic)=>{const id=String(++ref);if(socket?.readyState===1)socket.send(JSON.stringify({topic:messageTopic,event,payload,ref:id,join_ref:messageTopic===topic?'1':null}));return id};
  const dial=()=>{
   if(stopped)return;joined=false;ref=0;awaiting=null;
   try{socket=new WebSocketImpl(url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(key)+'&vsn=1.0.0')}catch{reconnect();return}
   const current=socket;
   socket.onopen=()=>{if(stopped||socket!==current)return;send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{key:''},postgres_changes:[{event:'*',schema:'public',table:'household_records',filter:'household_id=eq.'+householdId},{event:'*',schema:'public',table:'household_pantry_reviews',filter:'household_id=eq.'+householdId},...extraTables.filter(t=>['household_kitchen_preferences','household_kitchen_events','household_shopping_sessions','household_shopping_routes'].includes(t)).map(table=>({event:'*',schema:'public',table,filter:'household_id=eq.'+householdId}))]},access_token:token});
    pulse=repeat(()=>{if(awaiting){current.close();return}awaiting=send('heartbeat',{},'phoenix')},20000);
   };
   socket.onmessage=e=>{if(stopped||socket!==current)return;let message;try{message=JSON.parse(e.data)}catch{return}
    if(message.event==='phx_reply'&&message.ref===awaiting)awaiting=null;
    if(message.topic!==topic)return;
    if(message.event==='phx_reply'&&message.ref==='1'&&message.payload?.status==='ok'){attempt=0;joined=true;onReady()}
    if(message.event==='postgres_changes')onChange(message.payload?.data?.table);
    if(message.event==='phx_error'||message.event==='phx_close'||message.event==='phx_reply'&&message.payload?.status==='error')current.close();
   };
   socket.onerror=()=>current.close();
   socket.onclose=()=>{if(socket!==current)return;joined=false;stopRepeat(pulse);pulse=null;if(!stopped)reconnect()};
  };
  const reconnect=()=>{cancel(retry);retry=schedule(dial,Math.min(30000,1000*2**Math.min(attempt++,5)))};
  dial();return {healthy:()=>!stopped&&joined&&socket?.readyState===1,updateToken(next){token=next;if(socket?.readyState===1)send('access_token',{access_token:token})},close(){stopped=true;cancel(retry);stopRepeat(pulse);socket?.close()}};
 }
 function describeChanges(previous,next){
  const old=new Map(previous.map(r=>[r.bucket+':'+r.key,JSON.stringify(r.value)]));
  return next.filter(r=>['stock','cart'].includes(r.bucket)&&old.get(r.bucket+':'+r.key)!==JSON.stringify(r.value)).map(r=>({name:r.key,kind:r.bucket==='stock'?(r.value>0?'home':'gone'):r.value===null?'unlisted':r.value.done?'bought':'listed'}));
 }
 function connectData({url,key,token,userId,onChange,WebSocketImpl=WebSocket,schedule=setTimeout,cancel=clearTimeout,repeat=setInterval,stopRepeat=clearInterval}){
  let joined=false,stopped=false,socket=null,timer=null,heartbeat=null,attempt=0,ref=1,awaiting=null;
  const topic='realtime:private-chats:'+userId;
  const send=(event,payload={},messageTopic=topic)=>{const id=String(++ref);if(socket?.readyState===1)socket.send(JSON.stringify({topic:messageTopic,event,ref:id,payload}));return id};
  const retry=()=>{cancel(timer);timer=schedule(dial,Math.min(30000,1000*2**Math.min(attempt++,5)))};
  const dial=()=>{
   if(stopped)return;joined=false;ref=1;awaiting=null;
   try{socket=new WebSocketImpl(url.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(key)+'&vsn=1.0.0')}catch{retry();return}
   const current=socket;
   current.onopen=()=>{if(stopped||socket!==current)return;current.send(JSON.stringify({topic,event:'phx_join',ref:'1',payload:{access_token:token,config:{broadcast:{ack:false,self:false},presence:{key:''},postgres_changes:[{event:'*',schema:'public',table:'conversations'},{event:'*',schema:'public',table:'conversation_shares'}]}}}));
    heartbeat=repeat(()=>{if(awaiting){current.close();return}awaiting=send('heartbeat',{},'phoenix')},20000);
   };
   current.onmessage=e=>{if(stopped||socket!==current)return;let m;try{m=JSON.parse(e.data)}catch{return}
    if(m.event==='phx_reply'&&m.ref===awaiting)awaiting=null;
    if(m.topic!==topic)return;
    if(m.event==='postgres_changes')onChange();
    if(m.event==='phx_reply'&&m.ref==='1'&&m.payload?.status==='ok'){attempt=0;joined=true;onChange()}
    if(m.event==='phx_error'||m.event==='phx_close'||m.event==='phx_reply'&&m.payload?.status==='error')current.close();
   };
   current.onerror=()=>current.close();current.onclose=()=>{if(socket!==current)return;joined=false;stopRepeat(heartbeat);heartbeat=null;if(!stopped)retry()};
  };
  dial();return {healthy:()=>!stopped&&joined&&socket?.readyState===1,updateToken(next){token=next;if(socket?.readyState===1)send('access_token',{access_token:token})},close(){stopped=true;cancel(timer);stopRepeat(heartbeat);socket?.close()}};
 }

 return {connect,connectData,changedNames,describeChanges};
})();
if(typeof module!=='undefined')module.exports=HouseholdLive;
