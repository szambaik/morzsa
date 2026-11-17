import {createHandler} from './handler.mjs';
import {thumbnail} from '../recipe-image/thumbnail.ts';
Deno.serve(createHandler({
 url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 falKey:Deno.env.get('FAL_KEY'),thumbnail
}));
