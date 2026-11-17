// Isolated in-memory audit backend. Only public UI assets are served; no .env is read.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
export const actors={a:'00000000-0000-4000-8000-000000000001',b:'00000000-0000-4000-8000-000000000002',c:'00000000-0000-4000-8000-000000000003'};
export const householdId='90000000-0000-4000-8000-000000000001';
export async function startFixture({repoRoot,port=0}={}) {
 repoRoot ||= path.resolve(import.meta.dirname,'..');
 const db=new PGlite(),calls=[],unexpected=[],ai=[];
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
 for(const rel of ['supabase/schema.sql','supabase/migrations/20261109_pantry_reviews.sql','supabase/migrations/20261113_kitchen_intelligence.sql','supabase/migrations/20261114_shopping_mode.sql','supabase/migrations/20261114_persistent_library.sql','supabase/migrations/20261115_detailed_recipe_steps.sql','supabase/migrations/20261115_recipe_portions.sql','supabase/migrations/20261115_cooking_image_jobs.sql','supabase/migrations/20261117_chat_turn_page.sql','supabase/seeds/recipe-catalog.sql'])await db.exec(fs.readFileSync(path.join(repoRoot,rel),'utf8'));
 for(const id of Object.values(actors))await db.query('insert into auth.users values($1)',[id]);
 await db.query("insert into public.households values($1,'Audit kitchen',$2,now())",[householdId,actors.a]);
 for(const id of [actors.a,actors.b])await db.query('insert into public.household_members values($1,$2)',[householdId,id]);
 const rpcArgs={recipe_feed:['page_offset','page_size','search_text','tag'],conversation_index:['page_offset'],conversation_page:['cid','before_seq'],sync_conversation:['cid','meta','expected','items','recipe_ids'],save_recipe_document:['rid','recipe','labels'],set_recipe_library:['rid','liked','cooking_status'],share_conversation:['cid','hid'],delete_conversation:['cid'],clone_recipe_document:['rid','new_id'],begin_conversation_turn_page:['cid','tid'],begin_conversation_turn:['cid','tid'],end_conversation_turn:['cid','tid'],archive_shared_conversation:['cid','archived'],create_household:['household_name'],apply_household_changes:['hid','changes'],confirm_pantry_items:['hid','items'],set_kitchen_preferences:['hid','changes'],record_kitchen_recipe:['hid','kind','title','client_id'],start_shopping_session:['hid','sid'],set_shopping_route:['hid','categories','expected'],finish_shopping_session:['hid','sid','purchased','allow_unchecked']};
 let origin,serial=Promise.resolve();
 const server=http.createServer((req,res)=>{serial=serial.then(()=>handle(req,res)).catch(e=>{if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.message}));});});
 async function handle(req,res){
  const u=new URL(req.url,origin),actor=req.headers.authorization?.replace('Bearer audit-','')||'guest',id=actors[actor];
  const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  const chunks=[];let length=0;for await(const chunk of req){chunks.push(chunk);length+=chunk.length;if(length>2000000)return json({message:'Too large'},413)}
  const raw=Buffer.concat(chunks),body=raw.length?JSON.parse(raw.toString()):{};
  if(u.pathname.startsWith('/rest/')||u.pathname.startsWith('/auth/')){
   calls.push({actor,method:req.method,path:u.pathname,body});await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));
   try{
    if(u.pathname==='/auth/v1/user')return json({id,email:actor+'@audit.invalid'});
    if(u.pathname.startsWith('/auth/'))return json({message:'External auth and messages disabled in audit'},403);
    if(u.pathname.startsWith('/rest/v1/rpc/')){
     const name=u.pathname.split('/').at(-1);if(['list_household_email_invites','list_sent_household_invites'].includes(name))return json([]);
     if(!rpcArgs[name]){unexpected.push({path:u.pathname,method:req.method});return json({message:'Unsupported or prohibited audit RPC'},403)}
     const keys=rpcArgs[name].filter(k=>body[k]!==undefined),values=keys.map(k=>['meta','items','recipe','changes','purchased','categories'].includes(k)?JSON.stringify(body[k]):body[k]);
     const result=await db.query('select public.'+name+'('+keys.map((k,i)=>k+' := $'+(i+1)).join(',')+') data',values);return json(result.rows[0].data);
    }
    const table=u.pathname.split('/').at(-1);
    if(req.method!=='GET')return json({message:'Only allowlisted RPC mutations permitted'},405);
    if(table==='households')return json((await db.query('select * from public.households')).rows);
    if(table==='household_members')return json((await db.query('select user_id from public.household_members')).rows.map(r=>({...r,profiles:null})));
    if(table==='recipe_documents')return json((await db.query('select * from public.recipe_documents where id=$1',[u.searchParams.get('id')?.replace('eq.','')])).rows);
    if(table==='recipe_library_entries')return json((await db.query("select l.*,jsonb_build_object('id',r.id,'content',r.content,'tags',r.tags,'published',r.published) recipe_documents from public.recipe_library_entries l join public.recipe_documents r on r.id=l.recipe_id order by l.updated_at desc")).rows);
    if(['household_records','household_pantry_reviews','household_kitchen_preferences','household_kitchen_events','household_shopping_sessions','household_shopping_routes'].includes(table)){
     let rows=(await db.query('select * from public.'+table)).rows;
     for(const [key,value]of u.searchParams){if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));if(value==='is.null')rows=rows.filter(r=>r[key]===null)}
     return json(rows);
    }return json([]);
   }catch(e){return json({message:e.message},400)}
  }
  if(u.pathname.startsWith('/functions/')){
   calls.push({actor,method:req.method,path:u.pathname,body});
   if(req.method==='GET')return json({configured:true,enabled:true});
   if(u.pathname.endsWith('/recipe-image'))return json({status:'missing'});
   if((u.pathname.endsWith('/voice-command')||u.pathname.endsWith('/plus-assistant')&&body.task==='chat')&&ai.length){const plan=ai.shift();if(plan.delay)await new Promise(r=>setTimeout(r,plan.delay));if(plan.error)return json({message:plan.error},503);if(plan.stream){res.writeHead(200,{'Content-Type':'application/x-ndjson'});for(const chunk of plan.stream){res.write(JSON.stringify({type:'answer',text:chunk})+'\n');await new Promise(r=>setTimeout(r,plan.interval||250));}res.end(JSON.stringify({type:'done',output:plan.output})+'\n');return}return json(plan.output)}
   return json({message:'AI response requires explicit per-test contract fixture'},503);
  }
  if(req.method!=='GET')return json({message:'Read-only static files'},405);
  if(u.pathname==='/household-config.js'){res.setHeader('Content-Type','application/javascript');return res.end('window.MORZSA_CLOUD={url:'+JSON.stringify(origin)+',publishableKey:"audit-synthetic-only"};')}
  const relative=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';
  if(!/^(?:[a-zA-Z0-9-]+\.(?:html|js|css|webmanifest)|assets\/[a-zA-Z0-9_./ -]+\.(?:svg|png|webp|jpg|jpeg|woff2?|ttf|mp3|ogg))$/.test(relative)||relative.includes('..'))return json({message:'Not an audit UI asset'},404);
  const target=path.resolve(repoRoot,relative);if(!target.startsWith(repoRoot+path.sep)||!fs.existsSync(target))return json({message:'Missing asset'},404);
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.webmanifest':'application/manifest+json','.woff2':'font/woff2'})[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));
 }
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 return {origin,calls,unexpected,ai,db,close:async()=>{await new Promise(resolve=>server.close(resolve));await db.close();}};
}
