import { createHandler } from './handler.mjs';
Deno.serve(createHandler({
 url:Deno.env.get('SUPABASE_URL'),
 publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 geminiKey:Deno.env.get('GEMINI_API_KEY'),
 model:Deno.env.get('GEMINI_MODEL')||'gemini-3.1-flash-lite',
 origins:(Deno.env.get('RECIPE_AI_ORIGINS')||'https://szambaik.github.io').split(',')
}));
