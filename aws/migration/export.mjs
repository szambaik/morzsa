import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const quote=value=>"'"+value.replaceAll("'","''")+"'";
const identifier=value=>{if(!/^[a-z_][a-z_0-9]*$/.test(value))throw Error('Invalid source identifier');return '"'+value+'"';};
export function managementCredential(profile='supabase') {
  if(process.env.SUPABASE_ACCESS_TOKEN)return process.env.SUPABASE_ACCESS_TOKEN;
  const result=spawnSync('/usr/bin/security',['find-generic-password','-s','Supabase CLI','-a',profile,'-w'],{encoding:'utf8',timeout:10000});
  if(result.status!==0)throw Error('No local Supabase management credential; run supabase login locally');
  const value=result.stdout.trim(),prefix='go-keyring-base64:';
  return value.startsWith(prefix)?Buffer.from(value.slice(prefix.length),'base64').toString('utf8'):value;
}
export function managementQuery(project,query,token) {
  if(!/^[a-z]{20}$/.test(project))throw Error('Invalid source project');
  // A read-only SQL transaction is enforced by the management API. Credentials
  // travel over stdin to curl, never in shell text, process arguments or logs.
  const config=[
    'url = '+JSON.stringify('https://api.supabase.com/v1/projects/'+project+'/database/query'),
    'header = '+JSON.stringify('Authorization: Bearer '+token),
    'header = '+JSON.stringify('Content-Type: application/json'),
    'request = POST', 'data = '+JSON.stringify(JSON.stringify({query,read_only:true}))
  ].join(String.fromCharCode(10));
  const result=spawnSync('/usr/bin/curl',['-sS','--fail-with-body','--config','-'],{input:config,encoding:'utf8',timeout:120000,maxBuffer:128*1024*1024});
  if(result.status!==0)throw Error('Supabase read-only query failed (HTTP/client exit '+result.status+'); credentials and response suppressed');
  return JSON.parse(result.stdout);
}
export async function exportSnapshot({project='cbgcugshwivxpaurzyqq',profile='supabase',directory=fileURLToPath(new URL('./build/',import.meta.url))}={}) {
  const token=managementCredential(profile);
  const catalog=managementQuery(project,"select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",token);
  if(!catalog.length)throw Error('Source table inventory is empty');
  const tables=catalog.map(row=>row.table_name);
  const collection=(schema,table,columns='*')=>"(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from (select "+columns+' from '+identifier(schema)+'.'+identifier(table)+') t)';
  const tableValues=tables.flatMap(table=>[quote(table),collection('public',table)]).join(',');
  // All data collections below share a single PostgreSQL statement snapshot.
  // Sessions, password hashes, refresh tokens and provider credentials are not copied.
  const query="select jsonb_build_object('format',1,'project_ref',"+quote(project)+",'exported_at',now(),'public',jsonb_build_object("+tableValues+"),'auth_users',"+collection('auth','users','id,email,email_confirmed_at,phone,phone_confirmed_at,created_at,updated_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data,is_anonymous,banned_until')+",'auth_identities',"+collection('auth','identities','id,user_id,provider_id,provider,identity_data,created_at,updated_at,last_sign_in_at')+",'storage_buckets',"+collection('storage','buckets')+",'storage_objects',"+collection('storage','objects')+",'primary_keys',(select coalesce(jsonb_agg(jsonb_build_object('table',t.relname,'columns',(select jsonb_agg(a.attname order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=t.oid and a.attnum=k.attnum)) order by t.relname),'[]'::jsonb) from pg_constraint c join pg_class t on c.conrelid=t.oid join pg_namespace n on t.relnamespace=n.oid where c.contype='p' and n.nspname='public'),'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid)) order by p.proname,p.oid),'[]'::jsonb) from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.prokind='f'),'policies',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from pg_policies p where schemaname='public')) as snapshot";
  const rows=managementQuery(project,query,token),snapshot=rows[0]?.snapshot;
  if(snapshot?.format!==1||snapshot.project_ref!==project||tables.some(t=>!Array.isArray(snapshot.public?.[t])))throw Error('Incomplete source snapshot');
  const bytes=Buffer.from(JSON.stringify(snapshot));
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const manifest={format:1,projectRef:project,exportedAt:snapshot.exported_at,sha256,bytes:bytes.length,tables:Object.fromEntries(tables.map(t=>[t,snapshot.public[t].length])),users:snapshot.auth_users.length,identities:snapshot.auth_identities.length,storageBuckets:snapshot.storage_buckets.length,storageObjects:snapshot.storage_objects.length,rpcDefinitions:snapshot.functions.length};
  await mkdir(directory,{recursive:true,mode:0o700});
  await writeFile(directory+'/export.json',bytes,{mode:0o600});
  await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2),{mode:0o600});
  return manifest;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  exportSnapshot().then(manifest=>console.log(JSON.stringify(manifest,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
