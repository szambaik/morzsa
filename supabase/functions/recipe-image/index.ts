import {createHandler} from './handler.mjs';
import {thumbnail} from './thumbnail.ts';
Deno.serve(createHandler({
 url:Deno.env.get('SUPABASE_URL'),publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 openaiKey:Deno.env.get('OPENAI_API_KEY'),imageModel:Deno.env.get('OPENAI_IMAGE_MODEL')||'gpt-image-2.6-flare',
 groqKey:Deno.env.get('GROQ_API_KEY'),groqModel:Deno.env.get('GROQ_MODEL')||'openai/gpt-oss-120b',
 account:Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),token:Deno.env.get('CLOUDFLARE_API_TOKEN'),
 model:Deno.env.get('CLOUDFLARE_IMAGE_MODEL')||'@cf/black-forest-labs/flux-1-schnell',
 falKey:Deno.env.get('FAL_KEY'),falModel:Deno.env.get('FAL_IMAGE_MODEL'),plusImageProvider:Deno.env.get('PLUS_IMAGE_PROVIDER')||(Deno.env.get('FAL_KEY')?'fal':'openai'),
 catalogueProvider:Deno.env.get('CATALOGUE_IMAGE_PROVIDER')||(Deno.env.get('FAL_KEY')?'fal':'cloudflare'),
 // Optional codec loads only when a new catalogue thumbnail is needed.
 thumbnail,
 webhookUrl:Deno.env.get('SUPABASE_URL')+'/functions/v1/recipe-image-webhook',
 defer:(work:Promise<unknown>)=>EdgeRuntime.waitUntil(work),
 origins:(Deno.env.get('VOICE_ORIGINS')||'https://szambaik.github.io,capacitor://localhost,https://localhost').split(',')
}));
