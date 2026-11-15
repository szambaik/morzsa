// Isolated two-user UI harness backed by actual migrations. No external API calls.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {PGlite} from '@electric-sql/pglite';
const port=Number(process.env.MORZSA_QA_PORT)||8834;
const db=new PGlite();await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20261114_persistent_library.sql','utf8'));const detailed=fs.readFileSync('supabase/migrations/20261115_detailed_recipe_steps.sql','utf8');await db.exec(detailed);await db.exec(detailed);const portions=fs.readFileSync('supabase/migrations/20261115_recipe_portions.sql','utf8');await db.exec(portions);await db.exec(portions);await db.exec(fs.readFileSync('supabase/seeds/recipe-catalog.sql','utf8'));
const ids={a:'00000000-0000-4000-8000-000000000001',b:'00000000-0000-4000-8000-000000000002',c:'00000000-0000-4000-8000-000000000003'},hid='90000000-0000-4000-8000-000000000001';for(const id of Object.values(ids))await db.query('insert into auth.users values($1)',[id]);await db.query("insert into public.households values($1,'QA kitchen',$2,now())",[hid,ids.a]);for(const id of [ids.a,ids.b])await db.query('insert into public.household_members values($1,$2)',[hid,id]);
const rpcArgs={recipe_feed:['page_offset','page_size','search_text','tag'],conversation_index:['page_offset'],conversation_page:['cid','before_seq'],sync_conversation:['cid','meta','expected','items','recipe_ids'],save_recipe_document:['rid','recipe','labels'],set_recipe_library:['rid','liked','cooking_status'],share_conversation:['cid','hid'],delete_conversation:['cid'],clone_recipe_document:['rid','new_id'],begin_conversation_turn:['cid','tid'],end_conversation_turn:['cid','tid'],archive_shared_conversation:['cid','archived']};let serial=Promise.resolve();const images=new Map(),calls=[];
async function handle(req,res){const u=new URL(req.url,'http://127.0.0.1'),bytes=[];for await(const b of req)bytes.push(b);const raw=Buffer.concat(bytes),actor=req.headers.authorization?.replace('Bearer qa-','')||'guest',id=ids[actor];
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))};
 if(u.pathname.startsWith('/rest/')||u.pathname.startsWith('/auth/')){
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));
  try{
   if(u.pathname==='/auth/v1/user')return json({id});
   if(u.pathname.startsWith('/rest/v1/rpc/')){const name=u.pathname.split('/').at(-1),args=JSON.parse(raw||'{}');if(['list_household_email_invites','list_sent_household_invites'].includes(name))return json([]);if(!rpcArgs[name])return json(null);const names=rpcArgs[name].filter(k=>args[k]!==undefined),values=names.map(k=>['meta','items','recipe'].includes(k)?JSON.stringify(args[k]):args[k]);const result=await db.query('select public.'+name+'('+names.map((k,i)=>k+' := $'+(i+1)).join(',')+') data',values);return json(result.rows[0].data)}
   const table=u.pathname.split('/').at(-1);
   if(table==='households')return json((await db.query('select * from public.households')).rows);
   if(table==='household_members')return json((await db.query('select user_id from public.household_members')).rows.map(r=>({...r,profiles:null})));
   if(table==='recipe_documents'){const rid=u.searchParams.get('id')?.replace('eq.','');return json((await db.query('select * from public.recipe_documents where id=$1',[rid])).rows)}
   if(table==='recipe_library_entries')return json((await db.query('select l.*,jsonb_build_object(\'id\',r.id,\'content\',r.content,\'tags\',r.tags) recipe_documents from public.recipe_library_entries l join public.recipe_documents r on r.id=l.recipe_id order by l.updated_at desc')).rows);
   return json([]);
  }catch(e){return json({message:e.message},400)}
 }
 if(u.pathname==='/functions/v1/recipe-image'){const body=JSON.parse(raw);calls.push({actor,...body});const key=body.recipeId+'|'+body.step;if(body.create)images.set(key,true);return json(images.has(key)?{status:'ready',url:'http://127.0.0.1:'+port+'/storage/v1/object/public/recipe-catalog/'+body.recipeId+'/cover.jpg',expiresAt:Date.now()+86400000}:{status:'missing'})}
 if(u.pathname==='/qa/status')return json({calls});
 if(u.pathname.startsWith('/storage/v1/object/sign/chat-media/'))return json({signedURL:'/object/sign/chat-media/test.jpg'});
 if(u.pathname.startsWith('/storage/v1/object/chat-media/'))return json({Key:u.pathname});
 if(u.pathname.startsWith('/storage/v1/object/')){res.setHeader('Content-Type','image/jpeg');return res.end(fs.readFileSync('assets/food/pancake.jpg'))}
 if(u.pathname==='/'){
  const actor=u.searchParams.get('actor')||'a',user=ids[actor],lang=u.searchParams.get('lang')||'hu';let html=fs.readFileSync('index.html','utf8');const origin='http://127.0.0.1:'+port+'';
  html=html.replace(/<script src="household-config.js[^>]*><\/script>/,'<script>window.MORZSA_CLOUD={url:'+JSON.stringify(origin)+',publishableKey:"qa"};localStorage.setItem("morzsa-session",JSON.stringify({access_token:'+JSON.stringify('qa-'+actor)+',expires_at:9999999999,user:{id:'+JSON.stringify(user)+',email:"qa@example.test"}}));localStorage.setItem("morzsa-last-household-'+user+'",JSON.stringify({id:'+JSON.stringify(actor==='c'?null:hid)+',name:"QA kitchen"}));localStorage.setItem("morzsa-introduction-v1","done");</script>');
  html=html.replace('</body>','<script>household.voiceCommandStream=async(p,cb)=>{cb("Tesztválasz ");return {answer:"Tesztválasz: "+p.text,recipes:[],operations:[],clarification:"",transcript:p.text}};</script></body>');res.setHeader('Content-Type','text/html');return res.end(html);
 }
 const file=path.resolve('.'+decodeURIComponent(u.pathname));if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end()};res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(file));
}
http.createServer((req,res)=>{serial=serial.then(()=>handle(req,res)).catch(e=>{res.statusCode=500;res.end(String(e))})}).listen(port,'127.0.0.1',()=>console.log('Persistent UI fixture: http://127.0.0.1:'+port+'/'));
