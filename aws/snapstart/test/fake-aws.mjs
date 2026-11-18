#!/usr/bin/env node
// Synthetic CLI fixture. Never imports an AWS SDK or makes a network request.
import {writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const args=process.argv.slice(2),account='123456789012',stack='morzsa-snapstart-test';
const mode=process.env.MORZSA_PROBE_TEST_FAILURE;
const reply=data=>process.stdout.write(JSON.stringify(data));
if (args[0]==='sts') reply({Account:account});
else if (args[0]==='cloudformation') reply({Stacks:[{Outputs:['JavaSnap','JavaPlain','NodePlain'].map(name=>({
  OutputKey:name,OutputValue:'arn:aws:lambda:eu-north-1:'+(mode==='account'?'999999999999':account)+':function:'+stack+'-'+name+':probe'
}))}]});
else if (args[0]==='lambda' && args[1]==='get-function-configuration') reply({
  SnapStart:{ApplyOn:'PublishedVersions',OptimizationStatus:mode==='snapshot'?'Off':'On'}});
else if (args[0]==='lambda' && args[1]==='invoke') {
  if (args[args.indexOf('--output')+1]!=='json') throw new Error('Must request JSON explicitly');
  const name=args[args.indexOf('--function-name')+1],i=args.indexOf('--payload');
  const value=JSON.parse(args[i+1]).value;
  writeFileSync(args[i+2],JSON.stringify({digest:createHash('sha256').update(value).digest('hex'),nonce:randomUUID()}));
  const restore=name.includes('JavaSnap')?'RESTORE_REPORT Restore Duration: 35.75 ms\n':'';
  const init=name.includes('JavaSnap')?'':' Init Duration: 120.25 ms';
  const log=restore+'REPORT RequestId: synthetic-request Duration: 3.5 ms Billed Duration: 4 ms Memory Size: 256 MB Max Memory Used: 80 MB'+init+'\n';
  reply({StatusCode:200,LogResult:Buffer.from(log).toString('base64')});
} else throw new Error('Unexpected synthetic AWS CLI command');
