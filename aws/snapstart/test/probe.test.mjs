import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handler} from '../index.mjs';
import {createTemplate} from '../template.mjs';

test('probe validates bounded input and preserves Unicode and request uniqueness',async()=>{
  const value='Morzsa – próba 🥣',responses=await Promise.all(Array.from({length:100},()=>handler({value})));
  assert.equal(new Set(responses.map(r=>r.nonce)).size,100);
  for (const result of responses) assert.equal(result.digest,createHash('sha256').update(value).digest('hex'));
  for (const event of [null,{}, {value:3},{value:'a'.repeat(1001)}]) await assert.rejects(handler(event));
  assert.equal((await handler({value:''})).digest,createHash('sha256').update('').digest('hex'));
});

test('pilot uses published aliases and no application or public infrastructure',()=>{
  const t=createTemplate('abcdef0123456789'),types=Object.values(t.Resources).map(r=>r.Type);
  for (const type of ['AWS::Lambda::Function','AWS::Lambda::Version','AWS::Lambda::Alias'])
    assert.equal(types.filter(t=>t===type).length,3);
  assert.equal(t.Resources.JavaSnap.Properties.Code,t.Resources.JavaPlain.Properties.Code);
  for (const name of ['JavaSnap','JavaPlain','NodePlain']) {
    assert.equal(t.Resources[name].Properties.MemorySize,256);
    assert.equal(t.Resources[name+'Alias'].Properties.Name,'probe');
    assert.equal(t.Resources[name].Properties.VpcConfig,undefined);
    assert.equal(t.Resources[name+'Alias'].Properties.ProvisionedConcurrencyConfig,undefined);
  }
  assert.deepEqual(t.Resources.JavaSnap.Properties.SnapStart,{ApplyOn:'PublishedVersions'});
  assert.equal(t.Resources.NodePlain.Properties.SnapStart,undefined);
  assert.equal(t.Resources.JavaPlain.Properties.SnapStart,undefined);
  assert.ok(types.every(type=>['AWS::Lambda::Function','AWS::Lambda::Version','AWS::Lambda::Alias',
    'AWS::IAM::Role','AWS::Logs::LogGroup'].includes(type)));
  const permissions=t.Resources.ProbeRole.Properties.Policies[0].PolicyDocument.Statement[0];
  assert.deepEqual(permissions.Action,['logs:CreateLogStream','logs:PutLogEvents']);
  assert.throws(()=>createTemplate('bad-build'));
});
