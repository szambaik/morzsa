// Consume partial text for display; a validated final event is required for saving.
const ChatStream={async read(response,onAnswer){
 const reader=response.body?.getReader();if(!reader)throw Error('VOICE_INVALID_RESPONSE');const decoder=new TextDecoder();let buffer='',output=null,total=0;
 const line=text=>{if(!text.trim())return;const event=JSON.parse(text);if(output)throw Error('VOICE_INVALID_RESPONSE');if(event.type==='error')throw Error(event.error||'VOICE_UNAVAILABLE');if(event.type==='answer'){if(typeof event.text!=='string'||event.text.length>5000)throw Error('VOICE_INVALID_RESPONSE');onAnswer(event.text)}else if(event.type==='done')output=event.output;else throw Error('VOICE_INVALID_RESPONSE')};
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2000000)throw Error('VOICE_INVALID_RESPONSE');buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){line(buffer.slice(0,end));buffer=buffer.slice(end+1)}}buffer+=decoder.decode();if(buffer.trim())line(buffer);if(!output)throw Error('VOICE_INVALID_RESPONSE');return output}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}};
if(typeof module!=='undefined')module.exports=ChatStream;
