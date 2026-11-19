// Presentation only: pantry decisions and mutations stay in the existing models.
const ChatWorkspaceModel=(()=>{
 const generic=/^(?:újra|még|több|másik|másikat|megint|again|another|more|one more|anything else|új ötlet)(?:\s+(?:kérlek|please))?[?!.\s]*$/iu;
 const meaningful=text=>typeof text==='string'&&text.trim().length>3&&!generic.test(text.trim())&&!/^(?:(?:kérek|adj|szeretnék)(?:\s+egy|\s+pár|\s+néhány)?\s+(?:receptet|receptötletet|ötletet|receptötleteket)(?:\s+kérlek)?|(?:give|show|suggest)(?:\s+me)?(?:\s+an?|\s+some)?\s+(?:recipes?|ideas?)(?:\s+please)?)[?!.\s]*$/iu.test(text.trim())&&!/^(Új ötlet ·|New idea ·|Finomított ötletek ·|Refined ideas ·|Receptvariáció ·|Recipe variation ·)/u.test(text);
 function retained(value){
  if(!value)return null;
  const requests=[value.request,...(value.followUps||[])].filter(meaningful).map(s=>s.trim());
  const refinements=(value.refinements||[]).filter(k=>['less_cleanup','cheap','more_vegetables'].includes(k));
  if(!requests.length&&!refinements.length)return null;
  return {request:requests[0]||'',corrections:requests.slice(1),refinements};
 }
 function conversationContext(messages=[],origin=''){
  const latestUser=[...messages].reverse().find(m=>m.role==='user'),last=messages.at(-1);
  if(last?.recipes?.length)return {kind:'recipe',text:latestUser?.text||''};
  const text=latestUser?.text||'';
  if(!text)return {kind:['shopping','pantry'].includes(origin)?origin:'conversation',text:''};
  if(/bevásárl|bevásárol|boltban|listára|listán|listáról|shopping|grocer|bought|put away|elpakol|vettem|megvett|vettünk/iu.test(text))return {kind:'shopping',text};
  if(/elfogy|van otthon|megvan.*még|van.*még|készlet|pantry|stock|run out|still have/iu.test(text))return {kind:'pantry',text};
  return {kind:'conversation',text};
 }
 function relevantPrompt(prompt,context){
  if(!prompt)return false;
  if(prompt.type==='bought')return context.kind==='shopping';
  if(context.kind==='shopping')return ['restock','low','recurring'].includes(prompt.type);
  if(context.kind!=='pantry')return false;
  if(!context.text||/készlet(?:et)?\s+(?:át|ellenőrz)|(?:check|review).*(?:pantry|stock)/iu.test(context.text))return true;
  const normalize=s=>s.normalize('NFC').toLocaleLowerCase('hu').replace(/[^\p{L}\p{N}]+/gu,' ');
  const text=normalize(context.text);
  return (prompt.names||[]).some(name=>text.includes(normalize(name)));
 }
 return {retained,conversationContext,relevantPrompt};
})();
if(typeof module!=='undefined')module.exports=ChatWorkspaceModel;
if(typeof globalThis!=='undefined')globalThis.ChatWorkspaceModel=ChatWorkspaceModel;
