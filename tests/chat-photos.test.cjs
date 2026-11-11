const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../companion-model.js'),P=require('../recipe-photos.js');
const image={mimeType:'image/jpeg',data:fs.readFileSync('assets/food/pancake.jpg').toString('base64')};
test('multimodal request keeps current photo, strips history media, preserves old text/audio clients',async()=>{
 const {normalizeInput,bodyFor}=await import('../supabase/functions/voice-command/handler.mjs');
 const input=normalizeInput({assistant:true,companion:true,text:'What is this?',image,history:[{role:'user',text:'old',image}]});
 const b=bodyFor(input);assert.deepEqual(b.contents.at(-1).parts.at(-1).inlineData,image);assert.deepEqual(b.contents[0].parts,[{text:'old'}]);assert.match(b.systemInstruction.parts[0].text,/photo alone.*NEVER authorizes/);assert.equal(normalizeInput({text:'hello'}).image,undefined);
 for(const bad of [{image:{...image,mimeType:'image/svg+xml'}},{image:{...image,data:'a'.repeat(24)}},{image:{...image,data:'/9j/'+'a'.repeat(2000000)}},{audio:'abcd'},{text:''}])assert.throws(()=>normalizeInput({text:'photo',image,...bad}));
});
test('photo endpoint authenticates and claims quota; only provider receives image',async()=>{
 const {createHandler}=await import('../supabase/functions/voice-command/handler.mjs');const calls=[];
 const output={answer:'Pancakes.',transcript:'What is this?',operations:[],clarification:'',recipes:[]};
 const fn=createHandler({url:'https://test',publishableKey:'public',serviceKey:'secret',geminiKey:'key'},async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/user')?{id:'12345678-1234-1234-1234-123456789012'}:url.includes('/rpc/')?true:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]}))});
 assert.equal((await (await fn(new Request('https://fn'))).json()).supportsImages,true);
 const response=await fn(new Request('https://fn',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({assistant:true,companion:true,text:'What is this?',image})}));assert.equal(response.status,200);assert.deepEqual(await response.json(),output);assert.equal(calls.length,3);assert.ok(!JSON.stringify(calls.slice(0,2)).includes(image.data));assert.deepEqual(JSON.parse(calls[2].options.body).contents.at(-1).parts.at(-1).inlineData,image);
});
test('old histories remain readable, bounded thumbnails persist but are not sent in history',()=>{
 const photo='data:image/jpeg;base64,/9j/AAAAAAAAAAAA';
 const old={threads:[{id:'a',messages:[{role:'user',text:'old'},{role:'user',text:'photo',photo},{role:'user',text:'unsafe',photo:'https://tracking.test/x'}]}]};const out=M.normalize(old);assert.equal(out.threads[0].messages[0].text,'old');assert.equal(out.threads[0].messages[1].photo,photo);assert.equal(out.threads[0].messages[2].photo,undefined);assert.ok(!JSON.stringify(M.history(out.threads[0].messages)).includes('/9j/'));
 const many=M.normalize({threads:[{id:'a',messages:Array.from({length:40},()=>({role:'user',text:'photo',photo}))}]});assert.equal(many.threads[0].messages.filter(m=>m.photo).length,30);assert.equal(many.threads[0].messages.length,40);
});
test('food photos are curated, credited and unrelated dishes keep their existing artwork',()=>{
 for(const name of ['Almás palacsinta','Pasta','Zöldségleves','Fried rice','Sült csirke']){const p=P.match(name);assert.ok(p);assert.ok(fs.existsSync(p.src));assert.match(p.source,/commons.wikimedia.org/);assert.ok(p.author);assert.match(p.licenseUrl,/creativecommons.org/)}assert.equal(P.match('Chocolate mousse'),undefined);
});
