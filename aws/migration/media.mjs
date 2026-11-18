import {spawn,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./build/',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function downloadMedia() {
 const snapshot=JSON.parse(await readFile(root+'export.json','utf8'));
 const result=spawnSync('npx',['--yes','supabase','projects','api-keys','--project-ref',snapshot.project_ref,'--output','json'],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 if(result.status!==0)throw Error('Source image export credentials unavailable');
 const token=JSON.parse(result.stdout).find(k=>k.name==='service_role')?.api_key;
 if(!token)throw Error('Source image service-role credential unavailable');
 await mkdir(root+'objects',{recursive:true,mode:0o700});
 const manifest={format:1,projectRef:snapshot.project_ref,exportedAt:snapshot.exported_at,objects:[]};
 let previous;try{previous=JSON.parse(await readFile(root+'media-manifest.json','utf8'))}catch{}
 const work=snapshot.storage_objects.slice();let completed=0;
 const download=async object=>{
  if(!/^[a-zA-Z0-9_-]+$/.test(object.bucket_id)||typeof object.name!=='string')throw Error('Invalid source object name');
  const identity=object.bucket_id+'/'+object.name,localFile='objects/'+sha(Buffer.from(identity));
  const old=previous?.objects.find(o=>o.bucket===object.bucket_id&&o.path===object.name&&o.sourceUpdatedAt===object.updated_at);
  if(old){try{const bytes=await readFile(root+localFile);if(sha(bytes)===old.sha256){manifest.objects.push(old);return}}catch{}}
  const isPublic=snapshot.storage_buckets.find(b=>b.id===object.bucket_id)?.public===true;
  const url='https://'+snapshot.project_ref+'.supabase.co/storage/v1/object/'+(isPublic?'public/':'authenticated/')+object.bucket_id+'/'+object.name.split('/').map(encodeURIComponent).join('/');
  const config=['url = '+JSON.stringify(url),...(!isPublic?['header = '+JSON.stringify('Authorization: Bearer '+token)]:[])].join(String.fromCharCode(10));
  await new Promise((resolve,reject)=>{
   const child=spawn('/usr/bin/curl',['-sS','--fail','--max-time','60','--retry','2','--retry-all-errors','--config','-','--output',root+localFile],{stdio:['pipe','ignore','pipe']});
   child.stderr.resume();child.on('error',()=>reject(Error('Source image download unavailable')));child.on('close',code=>code===0?resolve():reject(Error('Source image download failed, exit '+code)));child.stdin.end(config);
  });
  const bytes=await readFile(root+localFile),size=Number(object.metadata?.size);
  if(!bytes.length||(Number.isFinite(size)&&size!==bytes.length))throw Error('Source object size changed; take a new snapshot');
  const mime=object.metadata?.mimetype??'application/octet-stream';
  manifest.objects.push({bucket:object.bucket_id,path:object.name,key:'objects/'+identity,localFile,bytes:bytes.length,sha256:sha(bytes),contentType:mime,sourceUpdatedAt:object.updated_at});
 };
 const workers=await Promise.allSettled(Array.from({length:4},async()=>{while(work.length){await download(work.shift());completed++;if(completed%25===0)console.log('Downloaded '+completed+' source images');}}));
 manifest.objects.sort((a,b)=>a.key.localeCompare(b.key));
 await writeFile(root+'media-manifest.json',JSON.stringify(manifest),{mode:0o600});
 for(const worker of workers)if(worker.status==='rejected')throw worker.reason;
 if(manifest.objects.length!==snapshot.storage_objects.length)throw Error('Incomplete image export');
 return {objects:manifest.objects.length,bytes:manifest.objects.reduce((n,o)=>n+o.bytes,0)};
}
if(process.argv[1]===fileURLToPath(import.meta.url))downloadMedia().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
