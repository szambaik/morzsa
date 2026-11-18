const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ChatStream=require('../chat-stream.js');
test('AWS queued chat exposes partial text before the validated final reply',async()=>{
 let calls=0;const partials=[],at=[];
 const output={answer:'Szia, segítek.',recipes:[],operations:[]};
 const states=[{jobId:'test-job'},{status:'pending',progress:{answer:'Szia,'}},{status:'pending',progress:{answer:output.answer}},output];
 const raw=async()=>{const i=calls++;return new Response(JSON.stringify(states[i]),{status:i<3?202:200,headers:{'Content-Type':'application/json'}})};
 const context={window:{MORZSA_CLOUD:{provider:'aws'},MORZSA_AWS:{url:'https://backend.example',authDomain:'https://auth.example',clientId:'client'},fetch:raw},PersistenceModel:{accountKey:()=> 'account'},HouseholdLive:{},document:{addEventListener(){}},location:{href:'https://app.example/',pathname:'/',origin:'https://app.example'},URL,URLSearchParams,Headers,Response,ReadableStream,TextEncoder,DOMException,setTimeout,clearTimeout,queueMicrotask};
 vm.runInNewContext(fs.readFileSync('aws-client.js','utf8'),context);
 const response=await context.window.fetch('https://backend.example/functions/v1/plus-assistant',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({stream:true})});
 assert.match(response.headers.get('Content-Type'),/x-ndjson/);
 const result=await ChatStream.read(response,text=>{partials.push(text);at.push(calls)});
 assert.deepEqual(partials,['Szia,',output.answer]);assert.deepEqual(at,[2,3]);
 assert.deepEqual(result,output);assert.equal(calls,4);
});
