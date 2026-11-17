import WebSocket from 'npm:ws@8.18.3';
import {createHandler} from './handler.mjs';
import {VOICE_SECONDS,realtimeCents} from './realtime.mjs';
const config={
 url:Deno.env.get('SUPABASE_URL'),publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 openaiKey:Deno.env.get('OPENAI_API_KEY'),textModel:Deno.env.get('OPENAI_TEXT_MODEL')||'gpt-6.1-terra',imageModel:Deno.env.get('OPENAI_IMAGE_MODEL')||'gpt-image-2.6-flare',voiceModel:Deno.env.get('OPENAI_REALTIME_MODEL')||'gpt-realtime-2.1-mini',
 origins:(Deno.env.get('VOICE_ORIGINS')||'https://szambaik.github.io,capacitor://localhost,https://localhost').split(','),
 defer:(work:Promise<unknown>)=>EdgeRuntime.waitUntil(work),
 watchCall:(callId:string,expected:any,end:()=>Promise<void>,settle:(cents?:number,usage?:any)=>Promise<void>,policy:{usageLimitsEnabled?:boolean}={})=>new Promise<void>(resolve=>{
  let finished=false,estimatedCents=0,measuredResponses=0;const responseIds=new Set<string>();const socket=new WebSocket('wss://api.openai.com/v1/realtime?call_id='+callId,{headers:{Authorization:'Bearer '+Deno.env.get('OPENAI_API_KEY')},handshakeTimeout:10000});
  const stop=async(reason='sideband')=>{if(finished)return;finished=true;clearTimeout(timer);socket.close();console.info(JSON.stringify({event:'morzsa_plus_voice_end',callId,reason,estimatedCents:Math.ceil(estimatedCents)}));try{await end()}catch{console.warn(JSON.stringify({event:'morzsa_plus_voice_hangup_failed'}))}finally{try{await settle(measuredResponses?estimatedCents:undefined,{measuredResponses,estimatedCents:measuredResponses?estimatedCents:null})}catch{console.warn(JSON.stringify({event:'morzsa_plus_voice_settlement_failed'}))}resolve()}};
  const timer=setTimeout(()=>stop('time'),VOICE_SECONDS*1000);
  socket.on('error',()=>stop('sideband_error'));socket.on('close',()=>stop('sideband_closed'));
  socket.on('message',(raw:any)=>{try{const event=JSON.parse(String(raw));if(event.type==='session.updated'){const s=event.session;if(s.model!==expected.model||s.instructions!==expected.instructions||s.max_output_tokens>expected.max_output_tokens)stop('session_override')}
   if(event.type==='response.done'){const usage=event.response?.usage;if(usage&&!responseIds.has(event.response.id)){responseIds.add(event.response.id);measuredResponses++;estimatedCents+=realtimeCents(usage,expected.model);if(policy.usageLimitsEnabled!==false&&estimatedCents>=25)stop('budget')}}
  }catch{stop('invalid_event')}});
 }),
};
Deno.serve(createHandler(config));
