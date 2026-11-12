const {test}=require('node:test'),assert=require('node:assert/strict');
test('short alternative requests retain the original goal through the Groq adapter',async()=>{
 const {normalizeInput,bodyFor}=await import('../supabase/functions/voice-command/handler.mjs');
 const {groqBody}=await import('../supabase/functions/voice-command/groq.mjs');
 const request={assistant:true,companion:true,stream:true,text:'Van más tipp?',history:[{role:'user',text:'Holnapra szeretnék egy sütit, amit bevihetek az irodába.'},...Array.from({length:8},(_,i)=>({role:i%2?'user':'model',text:'Beszélgetés '+i})),{role:'model',text:'Almás muffin.'}],context:{stock:['Csirkecomb','Alma']}};
 const body=groqBody(bodyFor(normalizeInput(request)),'test');
 assert.equal(body.messages[1].content,request.history[0].text);assert.equal(body.messages.at(-1).role,'user');assert.match(body.messages.at(-1).content,/Van más tipp/);
 assert.match(body.messages[0].content,/preserve the user’s ongoing goal/);assert.match(body.messages[0].content,/office-friendly sweet bake/);assert.match(body.messages[0].content,/CURRENT message for household changes/);
});
test('Groq preserves longer user constraints and respects a bounded history',async()=>{
 const {groqBody}=await import('../supabase/functions/voice-command/groq.mjs');
 const contents=Array.from({length:20},(_,i)=>({role:i%2?'model':'user',parts:[{text:'x'.repeat(2000)+' constraint '+i}]}));
 const body=groqBody({contents:[...contents,{role:'user',parts:[{text:'Másik?'}]}],systemInstruction:{parts:[{text:'rules'}]},generationConfig:{responseSchema:{}}},'test');
 assert.equal(body.messages.length,14);assert.match(body.messages[1].content,/constraint 8/);assert.match(body.messages.at(-1).content,/Másik/);
});
