import {createHandler} from './handler.mjs';
Deno.serve(createHandler({
 url:Deno.env.get('SUPABASE_URL'),publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 openaiKey:Deno.env.get('OPENAI_API_KEY'),imageModel:Deno.env.get('OPENAI_IMAGE_MODEL')||'gpt-image-2.6-flare',
 groqKey:Deno.env.get('GROQ_API_KEY'),groqModel:Deno.env.get('GROQ_MODEL')||'openai/gpt-oss-120b',
 account:Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),token:Deno.env.get('CLOUDFLARE_API_TOKEN'),
 model:Deno.env.get('CLOUDFLARE_IMAGE_MODEL')||'@cf/black-forest-labs/flux-1-schnell',
 falKey:Deno.env.get('FAL_KEY'),plusImageProvider:Deno.env.get('PLUS_IMAGE_PROVIDER')||(Deno.env.get('FAL_KEY')?'fal':'openai'),
 catalogueProvider:Deno.env.get('CATALOGUE_IMAGE_PROVIDER')||(Deno.env.get('FAL_KEY')?'fal':'cloudflare'),
 // Optional codec loads only when a new catalogue thumbnail is needed.
 thumbnail:async(bytes:Uint8Array)=>{const {Image}=await import('https://deno.land/x/imagescript@1.3.0/mod.ts');const image=await Image.decode(bytes);image.resize(320,Image.RESIZE_AUTO);return image.encodeJPEG(75)},
 origins:(Deno.env.get('VOICE_ORIGINS')||'https://szambaik.github.io,capacitor://localhost,https://localhost').split(',')
}));
