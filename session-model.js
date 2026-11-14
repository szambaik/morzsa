// Device-local navigation only. Household records and earlier chat saves are untouched.
const MorzsaSessionModel = (() => {
 const idleMs=25*60*1000,pages=['chat','overview','pantry','shopping','recipes'];
 const key=scope=>scope+':resume-v1';
 function normalize(value,validRecipe=()=>null){
  if(!value||value.version!==1||!Number.isFinite(value.activity)||value.activity<=0||!pages.includes(value.page)||typeof value.thread!=='string')return null;
  return {version:1,activity:value.activity,page:value.page,thread:value.thread,scroll:Math.max(0,Math.min(100000,Number(value.scroll)||0)),draft:typeof value.draft==='string'?value.draft.slice(0,2000):'',cookingView:value.cookingView==='focus'?'focus':'full',preview:validRecipe(value.preview),shoppingActive:value.shoppingActive===true};
 }
 function decide(saved,book,now=Date.now(),protectedWork=false){
  if(!saved)return 'unchanged';
  const thread=book.threads.find(t=>t.id===saved.thread);
  if(!thread)return 'unchanged';
  if(protectedWork||saved.page==='shopping'&&saved.shoppingActive||saved.draft.trim()||thread.kind==='recipe'&&thread.status==='active')return 'resume';
  return now-saved.activity>=idleMs?'fresh':'resume';
 }
 return {idleMs,key,normalize,decide};
})();
if(typeof module!=='undefined')module.exports=MorzsaSessionModel;
