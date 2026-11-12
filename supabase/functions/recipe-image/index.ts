import {createHandler} from './handler.mjs';
Deno.serve(createHandler({
 url:Deno.env.get('SUPABASE_URL'),publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 groqKey:Deno.env.get('GROQ_API_KEY'),groqModel:Deno.env.get('GROQ_MODEL')||'openai/gpt-oss-120b',
 account:Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),token:Deno.env.get('CLOUDFLARE_API_TOKEN'),
 model:Deno.env.get('CLOUDFLARE_IMAGE_MODEL')||'@cf/black-forest-labs/flux-1-schnell',
 origins:(Deno.env.get('VOICE_ORIGINS')||'https://szambaik.github.io,capacitor://localhost,https://localhost').split(',')
}));
