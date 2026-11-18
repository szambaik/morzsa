import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,mkdir,chmod,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
async function fixture(mode,run) {
  const directory=await mkdtemp(path.join(tmpdir(),'morzsa-snapstart-test-'));
  try {
    const bin=path.join(directory,'bin');await mkdir(bin);
    await copyFile(new URL('../benchmark.mjs',import.meta.url),path.join(directory,'benchmark.mjs'));
    await copyFile(new URL('./fake-aws.mjs',import.meta.url),path.join(bin,'aws'));
    await chmod(path.join(bin,'aws'),0o755);
    const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,MORZSA_PROBE_TEST_FAILURE:mode};
    await run(directory,env);
  } finally {await rm(directory,{recursive:true,force:true});}
}
test('benchmark validates 45 synthetic CLI calls and distinguishes init/restore from execution',async()=>{
  await fixture('',async(directory,env)=>{
    await exec(process.execPath,[path.join(directory,'benchmark.mjs'),'morzsa-snapstart-test','synthetic-profile'],{env});
    const report=JSON.parse(await readFile(path.join(directory,'build','snapstart-results.json'),'utf8'));
    assert.equal(report.samples.length,45);
    for (const sample of report.samples) {
      assert.equal(sample.durationMs,3.5);
      assert.equal(sample.restoreMs,sample.name==='JavaSnap'?35.75:null);
      assert.equal(sample.initMs,sample.name==='JavaSnap'?null:120.25);
    }
    assert.equal(report.summary.JavaSnap.observedRestores,15);
    assert.equal(report.summary.JavaPlain.observedRestores,0);
    assert.equal(report.summary.NodePlain.observedInits,15);
    assert.ok(!JSON.stringify(report).includes('synthetic-request'));
  });
});
test('benchmark refuses a different account and an unpublished/unready snapshot',async()=>{
  for (const [mode,message] of [['account',/outside the isolated/],['snapshot',/snapshot is not ready/]]) {
    await fixture(mode,async(directory,env)=>{
      await assert.rejects(exec(process.execPath,[path.join(directory,'benchmark.mjs'),'morzsa-snapstart-test'],{env}),message);
      await assert.rejects(readFile(path.join(directory,'build','snapstart-results.json')),e=>e.code==='ENOENT');
    });
  }
});
