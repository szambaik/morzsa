import WebSocket from 'npm:ws@8.18.3';
import {createHandler} from './handler.mjs';
import {VOICE_SECONDS} from './realtime.mjs';
const config={
 url:Deno.env.get('SUPABASE_URL'),publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 openaiKey:Deno.env.get('OPENAI_API_KEY'),textModel:Deno.env.get('OPENAI_TEXT_MODEL')||'gpt-6.1-terra',imageModel:Deno.env.get('OPENAI_IMAGE_MODEL')||'gpt-image-2.6-flare',voiceModel:Deno.env.get('OPENAI_REALTIME_MODEL')||'gpt-realtime-2.1-mini',
 origins:(Deno.env.get('VOICE_ORIGINS')||'https://szambaik.github.io,capacitor://localhost,https://localhost').split(','),
 defer:(work:Promise<unknown>)=>EdgeRuntime.waitUntil(work),
 watchCall:(callId:string,expected:any,end:()=>Promise<void>,settle:()=>Promise<void>)=>new Promise<void>(resolve=>{
  let finished=false,estimatedCents=0;const socket=new WebSocket('wss://api.openai.com/v1/realtime?call_id='+callId,{headers:{Authorization:'Bearer '+Deno.env.get('OPENAI_API_KEY')},handshakeTimeout:10000});
  const stop=async()=>{if(finished)return;finished=true;clearTimeout(timer);socket.close();try{await end();await settle()}catch{console.warn(JSON.stringify({event:'morzsa_plus_voice_cleanup_failed'}))}resolve()};
  const timer=setTimeout(stop,VOICE_SECONDS*1000);
  socket.on('error',stop);socket.on('close',stop);
  socket.on('message',(raw:any)=>{try{const event=JSON.parse(String(raw));if(event.type==='session.updated'){const s=event.session;if(s.model!==expected.model||s.instructions!==expected.instructions||s.max_output_tokens>expected.max_output_tokens)stop()}
   if(event.type==='response.done'){const usage=event.response?.usage;if(usage){const mini=expected.model==='gpt-realtime-2.1-mini';estimatedCents+=(Number(usage.input_tokens)||0)*(mini?10:32)/10000+(Number(usage.output_tokens)||0)*(mini?20:64)/10000;if(estimatedCents>=25)stop()}}
  }catch{stop()}});
 }),
};
Deno.serve(createHandler(config));
