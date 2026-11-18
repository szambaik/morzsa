import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';

const stack=process.argv[2],profile=process.argv[3];
if (!stack || !/^[A-Za-z][A-Za-z0-9-]{0,39}$/.test(stack)) {
  throw new Error('Usage: node benchmark.mjs STACK_NAME [AWS_PROFILE]; this invokes metered AWS services');
}
const region='eu-west-1',taskDir=await mkdtemp(path.join(tmpdir(),'morzsa-snapstart-'));
const aws=args=>new Promise((resolve,reject)=>{
  const child=spawn('aws',[...args,'--region',region,'--output','json',...(profile?['--profile',profile]:[])],
    {env:{...process.env,AWS_PAGER:''},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
  child.on('error',reject);child.on('close',code=>{
    if (code) { reject(new Error(stderr)); return; }
    try { resolve(JSON.parse(stdout)); } catch { reject(new Error('AWS CLI did not return JSON')); }
  });
});
const value='Morzsa – runtime próba 🥣',digest=createHash('sha256').update(value).digest('hex');
let counter=0;
try {
  const account=await aws(['sts','get-caller-identity']);
  const description=await aws(['cloudformation','describe-stacks','--stack-name',stack]);
  const outputs=Object.fromEntries(description.Stacks[0].Outputs.map(o=>[o.OutputKey,o.OutputValue]));
  const samples=[],nonces=new Set();
  for (const name of ['JavaSnap','JavaPlain','NodePlain']) {
    const arn=outputs[name],prefix='arn:aws:lambda:'+region+':'+account.Account+':function:'+stack+'-';
    if (!arn?.startsWith(prefix) || !arn.endsWith(':probe')) {
      throw new Error('Refusing to invoke a function outside the isolated stack/account/region alias');
    }
    const config=await aws(['lambda','get-function-configuration','--function-name',arn]);
    if (name==='JavaSnap' && (config.SnapStart?.ApplyOn!=='PublishedVersions' || config.SnapStart?.OptimizationStatus!=='On')) {
      throw new Error('SnapStart snapshot is not ready on the published probe alias');
    }
    const invoke=async phase=>{
      const file=path.join(taskDir,String(++counter)+'.json'),started=performance.now();
      const result=await aws(['lambda','invoke','--function-name',arn,'--log-type','Tail',
        '--cli-binary-format','raw-in-base64-out','--payload',JSON.stringify({value}),file]);
      const elapsedMs=performance.now()-started,response=JSON.parse(await readFile(file,'utf8'));
      if (result.FunctionError || response.digest!==digest || !/^[a-f0-9-]{36}$/.test(response.nonce) || nonces.has(response.nonce)) {
        throw new Error('Runtime probe failed content or request-uniqueness validation');
      }
      nonces.add(response.nonce);
      // Tail logs are transient; never save raw logs or request credentials.
      const log=Buffer.from(result.LogResult||'','base64').toString('utf8');
      const number=pattern=>{const match=log.match(pattern);return match?Number(match[1]):null};
      samples.push({name,phase,elapsedMs,durationMs:number(/REPORT RequestId:[^\n]*?\bDuration: ([\d.]+) ms/),
        initMs:number(/Init Duration: ([\d.]+) ms/),restoreMs:number(/Restore Duration: ([\d.]+) ms/)});
    };
    await invoke('first-observed');
    for (let i=0;i<10;i++) await invoke('sequential');
    const burst=await Promise.allSettled([invoke('burst'),invoke('burst'),invoke('burst'),invoke('burst')]);
    for (const result of burst) if (result.status==='rejected') throw result.reason;
  }
  const percentile=(values,p)=>{const sorted=values.sort((a,b)=>a-b);return sorted[Math.ceil(sorted.length*p)-1]??null};
  const summary=Object.fromEntries(['JavaSnap','JavaPlain','NodePlain'].map(name=>{
    const own=samples.filter(s=>s.name===name);
    return [name,{samples:own.length,observedInits:own.filter(s=>s.initMs!==null).length,
      observedRestores:own.filter(s=>s.restoreMs!==null).length,
      elapsedP50Ms:percentile(own.map(s=>s.elapsedMs),0.5),elapsedP95Ms:percentile(own.map(s=>s.elapsedMs),0.95)}];
  }));
  const report={at:new Date().toISOString(),region,summary,samples,
    limitations:['Runtime-only probe, no auth/database/AI requests; 15 samples per variant is exploratory',
      'CLI elapsed time includes local process and network overhead',
      'Cold/restore events are observed in Lambda logs; a burst does not guarantee new environments',
      'Java SnapStart has no additional SnapStart fee; requests, execution, logs and artifact storage remain metered']};
  const destination=fileURLToPath(new URL('./build/snapstart-results.json',import.meta.url));
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(destination,JSON.stringify(report,null,2)+'\n');
  console.log('Saved '+samples.length+' validated invocations to '+destination+'.');
} finally { await rm(taskDir,{recursive:true,force:true}); }
