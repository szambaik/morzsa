// Consumes the exact artifact that passed the build/sanity gate or full audit.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {S3Client,PutObjectCommand} from '@aws-sdk/client-s3';
import {CloudFrontClient,CreateInvalidationCommand} from '@aws-sdk/client-cloudfront';
const root=path.resolve(process.argv[2]||'web-dist'),bucket=process.env.AWS_FRONTEND_BUCKET,distribution=process.env.AWS_FRONTEND_DISTRIBUTION;
const version=JSON.parse(await readFile(path.join(root,'version.json'),'utf8'));
const verified=version.audit==='passed'||(version.verification==='build-sanity'&&version.sanity==='passed');
if(!bucket||!distribution||!verified||version.commit!==process.env.GITHUB_SHA||version.backend!=='aws')throw Error('Only the matching verified AWS web artifact can be published');
const s3=new S3Client({region:'eu-north-1',maxAttempts:3}),cdn=new CloudFrontClient({region:'us-east-1',maxAttempts:3});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg'};
async function walk(dir){const all=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())all.push(...await walk(p));else if(entry.isFile())all.push(p);else throw Error('Unexpected artifact entry')}return all}
async function upload(file){const key=path.relative(root,file).split(path.sep).join('/');const noCache=['index.html','version.json','manifest.webmanifest'].includes(key);const immutable=/[.-][a-f0-9]{8,}[.-]/i.test(key);await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:await readFile(file),ContentType:types[path.extname(key)]||'application/octet-stream',CacheControl:noCache?'no-cache, max-age=0, must-revalidate':immutable?'public, max-age=31536000, immutable':'public, max-age=3600'}))}
const files=await walk(root),pending=files.filter(file=>!['index.html','version.json'].includes(path.relative(root,file)));
// Existing hashed assets remain available to previously loaded clients.
let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<pending.length)await upload(pending[next++])}));
await upload(path.join(root,'version.json'));await upload(path.join(root,'index.html'));
const invalidation=await cdn.send(new CreateInvalidationCommand({DistributionId:distribution,InvalidationBatch:{CallerReference:version.commit+'-'+Date.now(),Paths:{Quantity:1,Items:['/*']}}}));
console.log(JSON.stringify({published:true,commit:version.commit,files:files.length,invalidationId:invalidation.Invalidation.Id}));
