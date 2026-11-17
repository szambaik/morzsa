const {test}=require('node:test'),assert=require('node:assert/strict');
const Client=require('../chat-stream');
const encoder=new TextEncoder(),line=e=>encoder.encode(JSON.stringify(e)+'\n'),sse=e=>encoder.encode('data: '+JSON.stringify(e)+'\n\n');
const recipe={title:'Almás "gyors" süti 🍎',summary:'Két főre, sütőben.',minutes:30,servings:2,equipment:['20 cm forma'],ingredients:[{name:'Alma',amount:'2 db'}],steps:['1. Készítsd elő az almát.\n2. Süsd puhára.'],stepTitles:['Az alma sütése']};
const output={answer:'Ezt ajánlom.',recipes:[recipe],operations:[],clarification:''};
const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('unfinished recipes expose only completed bounded card fields at every byte boundary',async()=>{
 const {recipePreviews}=await import('../supabase/functions/plus-assistant/recipe-preview.mjs'),raw=JSON.stringify(output);
 let first=-1;
 for(let i=0;i<=raw.length;i++)for(const r of recipePreviews(raw.slice(0,i))){first=first<0?i:first;assert.equal(r.title,recipe.title);assert.ok(Object.keys(r).every(k=>['title','summary','minutes','servings'].includes(k)));if(r.minutes!==undefined)assert.equal(r.minutes,30)}
 assert.ok(first<raw.indexOf('ingredients'));assert.deepEqual(recipePreviews(raw),[{title:recipe.title,summary:recipe.summary,minutes:30,servings:2}]);
 assert.deepEqual(recipePreviews('{"answer":"fake recipes: [{title: bad}]"'),[]);
 assert.deepEqual(recipePreviews('{"recipes":[{"title":"Good","minutes":2'),[{title:'Good'}]);
 assert.deepEqual(recipePreviews('{"recipes":[{"title":"Good","minutes":240,'),[{title:'Good',minutes:240}]);
 for(const raw of ['{"operations":[{"title":"Never preview this"}]}','{"recipes":[{"title":"a","title":"b"}]}','{"recipes":[{"title":"'+'x'.repeat(101)+'"}]}','{"recipes":[{"title":"a"}]} trailing'])assert.deepEqual(recipePreviews(raw),[]);
});
test('client previews cannot carry steps or operations and still need a final valid event',async()=>{
 const previews=[],partial={type:'recipe_preview',recipes:[{title:'Alma',steps:['unvalidated'],operations:[{action:'stock_remove'}]}]};
 await assert.rejects(()=>Client.read(new Response(line(partial)),()=>{},r=>previews.push(r)),/VOICE_INVALID_RESPONSE/);
 assert.deepEqual(previews,[[{title:'Alma',summary:undefined,minutes:undefined,servings:undefined}]]);
 await assert.rejects(()=>Client.read(new Response(line(partial)),()=>{}),/VOICE_INVALID_RESPONSE/);
 for(const recipes of [[{title:'',minutes:3}],[{title:'Alma',minutes:0}],[{title:'Alma',summary:'x'.repeat(301)}],Array(4).fill({title:'Alma'})])await assert.rejects(()=>Client.read(new Response(line({type:'recipe_preview',recipes})),()=>{},()=>{}),/VOICE_INVALID_RESPONSE/);
});
test('client terminates on done without waiting for transport close; partial stream never completes',async()=>{
 let cancelled=false;const response=new Response(new ReadableStream({start(c){c.enqueue(line({type:'done',output}))},cancel(){cancelled=true}}));
 assert.deepEqual(await Client.read(response,()=>{}),output);assert.equal(cancelled,true);
 await assert.rejects(()=>Client.read(new Response(line({type:'done',output:null})),()=>{}),/VOICE_INVALID_RESPONSE/);
});
test('OpenAI previews arrive before long steps and completion; provider EOF is not required',async()=>{
 const {openaiText}=await import('../supabase/functions/plus-assistant/openai.mjs');let stream,cancelled=false;const started=pause(),previewed=pause(),previews=[];
 const body={systemInstruction:{parts:[]},contents:[],generationConfig:{responseSchema:{type:'OBJECT',properties:{}}}};
 const work=openaiText(body,{openaiKey:'synthetic'},async()=>new Response(new ReadableStream({start(c){stream=c;started.resolve()},cancel(){cancelled=true}})),()=>{},undefined,rs=>{previews.push(rs);previewed.resolve()});
 await started.promise;const raw=JSON.stringify(output),at=raw.indexOf('ingredients');stream.enqueue(sse({type:'response.output_text.delta',delta:raw.slice(0,at)}));await previewed.promise;
 assert.equal(previews[0][0].title,recipe.title);assert.equal(previews[0][0].steps,undefined);
 stream.enqueue(sse({type:'response.output_text.delta',delta:raw.slice(at)}));stream.enqueue(sse({type:'response.completed',response:{status:'completed',usage:{output_tokens:50}}}));
 assert.deepEqual((await work).output,output);assert.equal(cancelled,true);
});
test('Plus negotiates previews; old clients keep answer/done and all clients wait for validation and settlement',async()=>{
 const {createHandler}=await import('../supabase/functions/plus-assistant/handler.mjs'),user='00000000-0000-4000-8000-000000000001';
 for(const preview of [false,true]){
  let providerBody;const settled=pause(),settlementStarted=pause(),fn=createHandler({url:'https://db.invalid',publishableKey:'synthetic',serviceKey:'synthetic',openaiKey:'synthetic'},async(url,options)=>{
   if(url.endsWith('/user'))return Response.json({id:user});if(url.endsWith('/reserve_morzsa_plus'))return Response.json({status:'reserved'});
   if(options.method==='PATCH'){settlementStarted.resolve();await settled.promise;return Response.json({})}
   providerBody=JSON.parse(options.body);return new Response(new ReadableStream({start(c){c.enqueue(sse({type:'response.output_text.delta',delta:JSON.stringify(output)}));c.enqueue(sse({type:'response.completed',response:{status:'completed',usage:{input_tokens:100,output_tokens:100}}}));c.close()}}));
  });
  const response=await fn(new Request('https://fn.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({task:'chat',requestId:crypto.randomUUID(),text:'Almás süti',assistant:true,companion:true,stream:true,recipePreview:preview})}));
  const previews=[];let done=false;const result=Client.read(response,()=>{},preview?r=>previews.push(r):undefined).then(r=>{done=true;return r});await settlementStarted.promise;
  assert.equal(done,false);settled.resolve();assert.equal((await result).transcript,'Almás süti');assert.equal(previews.length,preview?1:0);
  assert.equal(providerBody.text.format.schema.properties.recipes.items.properties.imagePrompt,undefined);
  assert.equal(providerBody.instructions.includes('40–70 word'),false);assert.ok(providerBody.instructions.includes('350–700'));
  assert.deepEqual(Object.keys(providerBody.text.format.schema.properties).slice(0,2),['answer','recipes']);
 }
});

test('paired provider steps preserve complete instructions and the old public recipe format',async()=>{
 const {textBodyFor,publicTextOutput}=await import('../supabase/functions/plus-assistant/text-contract.mjs'),{jsonSchema}=await import('../supabase/functions/plus-assistant/openai.mjs'),{normalizeInput,validOutput}=await import('../supabase/functions/voice-command/handler.mjs');
 const schema=jsonSchema(textBodyFor(normalizeInput({text:'Almás recept',assistant:true,companion:true})).generationConfig.responseSchema),r=schema.properties.recipes.items;
 assert.equal(r.properties.steps.items.type,'object');assert.equal(r.properties.stepTitles,undefined);assert.equal(r.properties.steps.maxItems,6);assert.equal(schema.properties.recipes.maxItems,3);
 const paired={...output,recipes:[{...recipe,steps:recipe.steps.map((instruction,i)=>({title:recipe.stepTitles[i],instruction})),stepTitles:undefined}]};
 const normalized=publicTextOutput(paired,'Alma');assert.deepEqual(normalized,{...output,transcript:'Alma'});assert.equal(validOutput(normalized),true);
 const broken=publicTextOutput({...paired,recipes:[{...paired.recipes[0],steps:[{title:'Incomplete'}]}]},'Alma');assert.equal(validOutput(broken),false);
});
