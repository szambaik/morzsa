// Consume partial text for display; a validated final event is required for saving.
const ChatStream={async read(response,onAnswer,onRecipes){
 const reader=response.body?.getReader();if(!reader)throw Error('VOICE_INVALID_RESPONSE');const decoder=new TextDecoder();let buffer='',output=null,total=0;
 const line=text=>{if(!text.trim())return;const event=JSON.parse(text);if(output)throw Error('VOICE_INVALID_RESPONSE');if(event.type==='error')throw Error(event.error||'VOICE_UNAVAILABLE');if(event.type==='answer'){if(typeof event.text!=='string'||event.text.length>5000)throw Error('VOICE_INVALID_RESPONSE');onAnswer(event.text)}else if(event.type==='recipe_preview'&&onRecipes){
  if(!Array.isArray(event.recipes)||event.recipes.length>3||!event.recipes.every(r=>r&&typeof r.title==='string'&&r.title.trim()&&r.title.length<=100&&(r.summary===undefined||typeof r.summary==='string'&&r.summary.length<=300)&&(r.minutes===undefined||Number.isInteger(r.minutes)&&r.minutes>=1&&r.minutes<=240)&&(r.servings===undefined||Number.isInteger(r.servings)&&r.servings>=1&&r.servings<=24)))throw Error('VOICE_INVALID_RESPONSE');
  onRecipes(event.recipes.map(({title,summary,minutes,servings})=>({title,summary,minutes,servings})));
 }else if(event.type==='done'){if(!event.output||typeof event.output!=='object'||Array.isArray(event.output))throw Error('VOICE_INVALID_RESPONSE');output=event.output}else throw Error('VOICE_INVALID_RESPONSE')};
 // done is the protocol terminator; transport EOF must not delay a valid result.
 try{while(!output){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2000000)throw Error('VOICE_INVALID_RESPONSE');buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){line(buffer.slice(0,end));buffer=buffer.slice(end+1)}}buffer+=decoder.decode();if(buffer.trim())line(buffer);if(!output)throw Error('VOICE_INVALID_RESPONSE');return output}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}};
if(typeof module!=='undefined')module.exports=ChatStream;
