// Cooking progress is metadata, never an inventory mutation or a replacement recipe.
const CookingSession=(()=>{
 const Experience=typeof CookingExperience==='undefined'?require('./cooking-experience'):CookingExperience;
 const positive=n=>Number.isFinite(n)&&n>0,stamp=n=>positive(n)?n:undefined;
 function normalize(value,recipe,status='active'){
  const v=value&&typeof value==='object'?value:{},count=recipe?.steps?.length||0;
  const timers=(Array.isArray(v.timers)?v.timers:[]).filter(t=>t&&typeof t.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(t.id)&&Number.isInteger(t.step)&&t.step>=0&&t.step<count&&typeof t.label==='string'&&t.label.length<=80&&positive(t.startedAt)&&positive(t.endsAt)&&t.endsAt>t.startedAt&&t.endsAt-t.startedAt<=7200000).slice(-12).map(t=>({id:t.id,step:t.step,label:t.label,startedAt:t.startedAt,endsAt:t.endsAt,updatedAt:stamp(t.updatedAt)||t.startedAt,...(t.cancelled===true?{cancelled:true}:{}),...(t.acknowledged===true?{acknowledged:true}:{}),durationMs:positive(t.durationMs)&&t.durationMs<=7200000?t.durationMs:t.endsAt-t.startedAt,...(Number.isFinite(t.pausedRemaining)&&t.pausedRemaining>=0&&t.pausedRemaining<=7200000?{pausedRemaining:t.pausedRemaining}:{})}));
  const f=v.feedback&&typeof v.feedback==='object'?v.feedback:{};
  return {...(['active','paused'].includes(v.activity)&&stamp(v.activityAt)?{activity:v.activity,activityAt:v.activityAt}:{}),phase:status==='completed'?'completion':['preparation','guided','completion'].includes(v.phase)?v.phase:'guided',...(stamp(v.startedAt)?{startedAt:v.startedAt}:{}),...(stamp(v.finishedAt)?{finishedAt:v.finishedAt}:{}),timers,...(v.guidance&&Experience.guidance(v.guidance,recipe,v.guidance.step)&&typeof v.guidance.portions==='string'?{guidance:{...Experience.guidance(v.guidance,recipe,v.guidance.step),portions:v.guidance.portions}}:{}),...(Array.isArray(v.equipmentReady)?{equipmentReady:v.equipmentReady.filter(n=>Number.isInteger(n)&&n>=0&&n<(recipe?.equipment?.length||0))}:{}),feedback:{...(Number.isInteger(f.rating)&&f.rating>=1&&f.rating<=5?{rating:f.rating}:{}),...(Number.isInteger(f.leftoverPortions)&&f.leftoverPortions>=0&&f.leftoverPortions<=24?{leftoverPortions:f.leftoverPortions}:{}),notes:typeof f.notes==='string'?f.notes.slice(0,1000):'',householdFavourite:f.householdFavourite===true},...(v.consumptionReviewed===true?{consumptionReviewed:true}:{})};
 }
 const phase=t=>normalize(t?.cooking,t?.recipe,t?.status).phase;
 // A dormant session is resumable, never silently deleted or completed.
 const staleAfter=24*60*60*1000;
 function lifecycle(t,now=Date.now()){
  if(t?.kind!=='recipe'||!t.recipe||t.readOnly||t.archivedAt)return 'history';
  if(t.status==='completed'||phase(t)==='completion')return 'completed';
  if(t.cooking?.activity==='paused'||now-(t.updated||0)>staleAfter)return 'paused';
  return phase(t)==='preparation'?'preparation':'active';
 }
 function sessions(threads,now=Date.now()){
  const seen=new Set(),all=threads.filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return ['active','paused','preparation'].includes(lifecycle(t,now))}).sort((a,b)=>b.updated-a.updated);
  return {all,active:all.filter(t=>lifecycle(t,now)==='active'),paused:all.filter(t=>lifecycle(t,now)==='paused'),preparation:all.filter(t=>lifecycle(t,now)==='preparation')};
 }
 function activity(t,value,now=Date.now()){
  if(t.readOnly||!['active','paused'].includes(value)||lifecycle(t,now)==='completed')throw Error('INVALID_COOKING_ACTIVITY');
  return {...normalize(t.cooking,t.recipe,t.status),activity:value,activityAt:now};
 }
 function begin(t,now=Date.now()){return {...normalize(t.cooking,t.recipe,t.status),phase:'guided',activity:'active',activityAt:now,startedAt:stamp(t.cooking?.startedAt)||now}}
 function finish(t,now=Date.now()){return {...normalize(t.cooking,t.recipe,t.status),phase:'completion',finishedAt:stamp(t.cooking?.finishedAt)||now}}
 function addTimer(t,{id,minutes,label,step=t.cookingStep||0},now=Date.now()){
  if(t.readOnly||t.status!=='active'||phase(t)!=='guided'||!Number.isInteger(minutes)||minutes<1||minutes>120||typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id)||typeof label!=='string'||!label.trim()||label.length>80||!Number.isInteger(step)||step<0||step>=t.recipe.steps.length)throw Error('INVALID_COOKING_TIMER');
  const c=normalize(t.cooking,t.recipe,t.status);if(c.timers.some(x=>x.id===id))return c;
  if(c.timers.filter(x=>!x.cancelled&&!x.acknowledged).length>=8)throw Error('COOKING_TIMER_LIMIT');
  return {...c,timers:[...c.timers.filter(x=>!x.cancelled&&!x.acknowledged).slice(-11),{id,step,label,startedAt:now,endsAt:now+minutes*60000,updatedAt:now}]};
 }
 function pause(t,paused,now=Date.now()){if(t.readOnly||t.status!=='active'||phase(t)!=='guided')throw Error('INVALID_COOKING_SESSION');return activity(t,paused?'paused':'active',now)}
 function timerAction(t,id,action,now=Date.now()){
  if(t.readOnly||!['cancel','acknowledge','pause','resume','reset'].includes(action))throw Error('INVALID_COOKING_TIMER');
  const c=normalize(t.cooking,t.recipe,t.status);return {...c,timers:c.timers.map(x=>{
   if(x.id!==id||x.cancelled||x.acknowledged)return x;
   const durationMs=x.durationMs||x.endsAt-x.startedAt,updatedAt=Math.max(now,(x.updatedAt||0)+1);
   if(action==='cancel'||action==='acknowledge')return {...x,[action==='cancel'?'cancelled':'acknowledged']:true,updatedAt};
   if(action==='pause')return x.pausedRemaining!==undefined?x:{...x,pausedRemaining:Math.max(0,x.endsAt-now),updatedAt};
   if(action==='reset')return {...x,startedAt:now,endsAt:now+durationMs,pausedRemaining:durationMs,updatedAt};
   if(x.pausedRemaining===undefined)return x;
   const {pausedRemaining,...running}=x;return {...running,startedAt:now-(durationMs-pausedRemaining),endsAt:now+pausedRemaining,updatedAt};
  })};
 }
 const remaining=(timer,now=Date.now())=>Math.max(0,Math.ceil((timer.pausedRemaining??(timer.endsAt-now))/1000));
 const clock=seconds=>Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 function cues(text){
  const result=[];const re=/(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*(?:perc(?:ig|et|es)?|minutes?|mins?)\b/gi;let m;
  while((m=re.exec(text||''))&&result.length<3){const min=Number(m[1]),max=Number(m[2]||m[1]);if(min>=1&&max<=120&&min<=max)result.push({minutes:min,label:m[0]})}return result;
 }
 function context(t,now=Date.now()){const c=normalize(t.cooking,t.recipe,t.status);return {phase:c.phase,paused:c.activity==='paused',completedSteps:t.completedSteps||[],timers:c.timers.filter(x=>!x.cancelled&&!x.acknowledged).map(x=>({id:x.id,step:x.step,label:x.label,remainingSeconds:remaining(x,now),paused:x.pausedRemaining!==undefined})),...(c.feedback.notes?{notes:c.feedback.notes}:{})}}
 function merge(remote={},local={}){
  const timers=new Map();for(const t of [...(remote.timers||[]),...(local.timers||[])]){const old=timers.get(t.id);if(!old||(t.updatedAt||t.startedAt)>(old.updatedAt||old.startedAt)||(t.updatedAt||t.startedAt)===(old.updatedAt||old.startedAt)&&(!old.cancelled&&!old.acknowledged||t.cancelled||t.acknowledged))timers.set(t.id,t)}
  const activity=(remote.activityAt||0)>(local.activityAt||0)?remote:local;
  return {...remote,...local,...(activity.activityAt?{activity:activity.activity,activityAt:activity.activityAt}:{}),timers:[...timers.values()],...(remote.phase==='completion'||local.phase==='completion'?{phase:'completion'}:{})};
 }
 // Speech must explicitly request an action; model-selected tools alone are insufficient.
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function voiceAction(text){const s=norm(text).replace(/[.!?,]/g,'').trim();if(/(?:^|\b)(?:ne |dont |do not |if |ha |mi torten|what if)/.test(s))return '';
  if(/^(?:kesz|kesz vagyok|elkeszultem|kesz tovabb|elkeszultem tovabb|kovetkezo|kovetkezo lepes|mehet a kovetkezo|menjunk tovabb|tovabb|next|next step|done|done next|im done)$/.test(s))return 'advance';
  if(/(?:ismetel|mondd (?:el )?ujra|repeat|read.*step)/.test(s))return 'repeat';
  if(/(?:elozo lepes|previous step|go back)/.test(s))return 'previous';
  if(/(?:idozit|timer|szolj.*perc|jelez.*perc)/.test(s))return 'timer';return '';
 }
 function voiceMinutes(text){
  if(voiceAction(text)!=='timer')return null;const s=norm(text),match=s.match(/(?:^|\s)(\d{1,3}|egy|ket|ketto|harom|negy|ot|hat|het|nyolc|kilenc|tiz|husz|harminc|one|two|three|four|five|ten|twenty|thirty)\s*(?:perc|minute|min)/);
  if(!match)return null;const words={egy:1,ket:2,ketto:2,harom:3,negy:4,ot:5,hat:6,het:7,nyolc:8,kilenc:9,tiz:10,husz:20,harminc:30,one:1,two:2,three:3,four:4,five:5,ten:10,twenty:20,thirty:30},n=Number(match[1])||words[match[1]];return n>=1&&n<=120?n:null;
 }
 function voiceStep(text,current,count){
  if(voiceAction(text)==='previous')return current>0?current-1:null;
  const s=norm(text);if(/\b(?:ne|dont|not|ha|if)\b/.test(s)||!/(?:ugorj|menj|lepj|go to|jump to)/.test(s))return null;
  const m=s.match(/(?:^|\s)(\d{1,2})\.?\s*(?:lepes|step)/);if(!m)return null;const n=Number(m[1])-1;return n>=0&&n<count?n:null;
 }
 return {lifecycle,sessions,activity,staleAfter,normalize,phase,begin,finish,pause,addTimer,timerAction,remaining,clock,cues,context,merge,voiceAction,voiceMinutes,voiceStep};
})();
if(typeof window!=='undefined')window.CookingSession=CookingSession;
if(typeof module!=='undefined')module.exports=CookingSession;
