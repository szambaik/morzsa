import { createHandler } from './handler.mjs';
Deno.serve(createHandler({
 url:Deno.env.get('SUPABASE_URL'),
 publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 groqKey:Deno.env.get('GROQ_API_KEY'),
 groqModel:Deno.env.get('GROQ_MODEL')||'openai/gpt-oss-120b',
 geminiKey:Deno.env.get('GEMINI_API_KEY'),
 model:Deno.env.get('VOICE_MODEL')||'gemini-3.1-flash-lite',
 fallbackModel:Deno.env.get('VOICE_FALLBACK_MODEL')??'gemini-3.5-flash-lite',
 origins:(Deno.env.get('VOICE_ORIGINS')||'https://szambaik.github.io,capacitor://localhost,https://localhost').split(',')
}));
