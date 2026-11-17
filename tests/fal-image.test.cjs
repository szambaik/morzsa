const {test}=require('node:test'),assert=require('node:assert/strict');
const rid='10000000-0000-4000-8000-000000000001',uid='00000000-0000-4000-8000-000000000001';
const recipe={title:'Almás sütemény',summary:'Négy főre.',servings:4,minutes:45,ingredients:[{name:'Alma',amount:'4 db'}],steps:['Melegítsd elő a sütőt és vajazz ki egy formát.','Keverd össze a tésztát.']};
function harness({model='fal-ai/flux-2/klein/4b',legacy=false,content=recipe,published=true}={}){let job=legacy?{state:'pending',lease:'lease',model:'fal-ai/flux/schnell',provider_request:{id:'request-123',statusUrl:'https://queue.fal.run/fal-ai/flux/requests/request-123/status',resultUrl:'https://queue.fal.run/fal-ai/flux/requests/request-123',paidRequest:'paid-request',userId:uid}}:null,submissions=0,finished=false,uploads=0;const calls=[];
 const fetcher=async(url,options={})=>{calls.push({url,options});const body=typeof options.body==='string'?JSON.parse(options.body):null;
  if(url.includes('/recipe_documents?'))return Response.json([{id:rid,published,owner_id:published?null:uid,content}]);
  if(url.endsWith('/auth/v1/user'))return Response.json({id:uid});
  if(url.includes('/recipe_image_jobs?'))return Response.json([]);
  if(url.includes('/recipe_asset_jobs?')){if(options.method==='PATCH'){job={...job,...body};return Response.json([job])}return Response.json(job?[job]:[])}
  if(url.includes('/rpc/claim_recipe_asset')){if(job)return Response.json({status:job.state});job={state:'pending',lease:'lease',model:body.image_model};return Response.json({status:'claimed',lease:'lease'})}
  if(url.includes('/rpc/reserve_morzsa_plus'))return Response.json({status:'reserved'});
  if(url.includes('/morzsa_plus_requests?'))return Response.json({});
  if(url.includes('groq.com'))return Response.json({choices:[{message:{content:JSON.stringify({dish:'Apple cake',scene:'A clean round buttered baking tin next to an oven, no batter or mixing bowl. Warm daylight in a tidy kitchen.'})}}]});
  if(url==='https://queue.fal.run/'+model){submissions++;assert.equal(body.num_inference_steps,4);assert.equal(body.num_images,1);assert.equal(body.image_size.width*body.image_size.height<=1000000,true);return Response.json({request_id:'request-123',status_url:'https://queue.fal.run/'+model+'/requests/request-123/status',response_url:'https://queue.fal.run/'+model+'/requests/request-123'})}
  if(url.endsWith('/status'))return Response.json({status:finished?'COMPLETED':'IN_PROGRESS'});
  if(url.endsWith('/requests/request-123'))return Response.json({images:[{url:'https://v3.fal.media/files/image.jpg'}]});
  if(url.startsWith('https://v3.fal.media'))return new Response(new Uint8Array([255,216,255,1]),{headers:{'Content-Type':'image/jpeg'}});
  if(url.includes('/storage/v1/object/sign/'))return Response.json({signedURL:'/object/sign/recipe-images/'+rid+'/cover.jpg'});
  if(url.includes('/storage/v1/object/')){uploads++;return Response.json({})}throw Error('Unexpected '+url);
 };
 return {config:{url:'https://cloud',publishableKey:'anon',serviceKey:'service',falKey:'fal-key',falModel:model,groqKey:'groq',catalogueProvider:'fal',plusImageProvider:'fal',origins:['https://app']},fetcher,calls,get submissions(){return submissions},get uploads(){return uploads},get job(){return job},finish(){finished=true}};
}
const request=(create=true,auth=true,step=0)=>new Request('https://fn',{method:'POST',headers:{origin:'https://app',...(auth?{authorization:'Bearer user'}:{})},body:JSON.stringify({recipeId:rid,step,create})});
test('fal jobs persist request handles, recover after navigation and never submit again for polling/cache/model changes',async()=>{const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs'),h=harness(),fn=createHandler(h.config,h.fetcher);assert.equal((await (await fn(request())).json()).status,'pending');assert.equal(h.submissions,1);assert.equal(h.job.provider_request.id,'request-123');assert.equal((await (await fn(request(false,false))).json()).status,'pending');assert.equal(h.submissions,1);h.finish();const r=await fn(request(false,false));assert.equal(r.status,200);assert.equal((await r.json()).status,'ready');assert.equal(h.uploads,1);assert.equal(h.job.state,'ready');h.config.catalogueProvider='openai';await fn(request());assert.equal(h.submissions,1);assert.equal(h.uploads,1);const prompt=JSON.parse(h.calls.find(c=>c.url.includes('groq.com')).options.body).messages[1].content;assert.match(prompt,/vajazz/);assert.doesNotMatch(prompt,/Keverd össze/)});
test('fal output and status URLs are validated, unsafe hosts never receive credentials or downloads',async()=>{const {pollFal}=await import('../supabase/functions/recipe-image/fal.mjs');let calls=0;await assert.rejects(()=>pollFal({id:'request-123',statusUrl:'https://evil.example/status',resultUrl:'https://evil.example/result'},{falKey:'key'},async()=>{calls++}),/IMAGE_UNAVAILABLE/);assert.equal(calls,0);await assert.rejects(()=>pollFal({id:'request-123',statusUrl:'https://queue.fal.run/fal-ai/flux/requests/request-123/status',resultUrl:'https://queue.fal.run/fal-ai/flux/requests/request-123'},{falKey:'key'},async(url)=>{calls++;return Response.json(url.endsWith('/status')?{status:'COMPLETED'}:{images:[{url:'http://localhost/private'}]})}),/IMAGE_UNAVAILABLE/);assert.equal(calls,2)});
test('OpenAI step prompt uses only active technique and omits subsequent recipe actions',async()=>{const {openaiImage}=await import('../supabase/functions/plus-assistant/openai.mjs');let body;await openaiImage({recipe,step:0},{openaiKey:'key'},async(_,options)=>{body=JSON.parse(options.body);return Response.json({data:[{b64_json:Buffer.from([255,216]).toString('base64')}]})});assert.match(body.prompt,/activeInstruction/);assert.match(body.prompt,/vajazz/);assert.doesNotMatch(body.prompt,/Keverd össze/)});
test('transient fal status failures preserve the handle; an explicit terminal failure ends polling',async()=>{
 const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs'),h=harness();let statusFailure=false,terminal=false;
 const fn=createHandler(h.config,async(url,options)=>url.endsWith('/status')&&statusFailure?new Response('',{status:503}):url.endsWith('/status')&&terminal?Response.json({status:'FAILED'}):h.fetcher(url,options));
 await fn(request());statusFailure=true;assert.equal((await fn(request(false))).status,503);assert.equal(h.job.state,'pending');assert.equal(h.submissions,1);statusFailure=false;h.finish();assert.equal((await (await fn(request(false))).json()).status,'ready');assert.equal(h.submissions,1);
 const t=harness(),failed=createHandler(t.config,async(url,options)=>url.endsWith('/status')?Response.json({status:'FAILED'}):t.fetcher(url,options));await failed(request());assert.equal((await failed(request(false))).status,503);assert.equal(t.job.state,'failed');await failed(request(false));assert.equal(t.submissions,1);
});

test('Klein covers reuse the saved English description without another LLM call and settle their own price',async()=>{
 const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs');
 const imagePrompt='A slice of rustic apple cake on a cream ceramic plate, with visible soft apple pieces and a golden baked crumb. Warm daylight, simple kitchen background, no toppings.';
 const h=harness({published:false,content:{...recipe,imagePrompt}});h.config.groqKey='';const fn=createHandler(h.config,h.fetcher);
 assert.equal((await fn(request(true,true,-1))).status,202);assert.equal(h.job.model,'fal-ai/flux-2/klein/4b');assert.equal(h.job.provider_request.model,h.job.model);
 assert.equal(h.calls.some(c=>c.url.includes('groq.com')),false);assert.ok(JSON.parse(h.calls.find(c=>c.url==='https://queue.fal.run/fal-ai/flux-2/klein/4b').options.body).prompt.startsWith(imagePrompt));
 h.finish();assert.equal((await fn(request(false,true,-1))).status,200);
 const settled=JSON.parse(h.calls.find(c=>c.url.includes('/morzsa_plus_requests?')).options.body);assert.equal(settled.model,'fal-ai/flux-2/klein/4b');assert.equal(settled.usage.estimatedCents,0.5);assert.equal(h.submissions,1);
});
test('a stored Schnell handle finishes after the default changes, retaining its original model and price',async()=>{
 const {createHandler}=await import('../supabase/functions/recipe-image/handler.mjs'),h=harness({legacy:true});h.finish();
 assert.equal((await createHandler(h.config,h.fetcher)(request(false))).status,200);assert.equal(h.submissions,0);assert.equal(h.uploads,1);
 const settled=JSON.parse(h.calls.find(c=>c.url.includes('/morzsa_plus_requests?')).options.body);assert.equal(settled.model,'fal-ai/flux/schnell');assert.equal(settled.usage.estimatedCents,0.3);
});
test('both documented Klein queue URL forms work; model mismatches and credential-bearing URLs fail before fetching',async()=>{
 const {pollFal}=await import('../supabase/functions/recipe-image/fal.mjs');let calls=0;
 for(const base of ['/fal-ai/flux-2','/fal-ai/flux-2/klein/4b']){
  const job={model:'fal-ai/flux-2/klein/4b',id:'request-123',statusUrl:'https://queue.fal.run'+base+'/requests/request-123/status',resultUrl:'https://queue.fal.run'+base+'/requests/request-123'};
  assert.equal(await pollFal(job,{falKey:'key'},async()=>{calls++;return Response.json({status:'IN_PROGRESS'})}),null);
  for(const overrides of [{resultUrl:job.resultUrl.replace('flux-2','flux')},{statusUrl:job.statusUrl+'?redirect=bad'},{resultUrl:job.resultUrl.replace('https://','https://user:pass@')},{id:'wrong-request'},{model:'fal-ai/anything'}]){const before=calls;await assert.rejects(()=>pollFal({...job,...overrides},{falKey:'key'},async()=>{calls++;return Response.json({})}),/IMAGE_UNAVAILABLE/);assert.equal(calls,before)}
 }
});
test('a prepared cover never replaces the active cooking-step prompt',async()=>{
 const {imagePrompt}=await import('../supabase/functions/recipe-image/handler.mjs');let sent;
 await imagePrompt({recipe:{...recipe,imagePrompt:'Finished apple cake, already baked and sliced on a plate.'},step:0},{groqKey:'key'},async(_,o)=>{sent=JSON.parse(JSON.parse(o.body).messages[1].content);return Response.json({choices:[{message:{content:JSON.stringify({dish:'Apple cake',scene:'A clean greased baking tin beside the preheating oven, no batter or finished cake.'})}}]})});
 assert.equal(sent.activeInstruction,recipe.steps[0]);assert.equal(sent.recipe,undefined);assert.doesNotMatch(JSON.stringify(sent),/already baked|Keverd össze/);
});
