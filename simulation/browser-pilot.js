// Load with the authorized Playwright browser_run_code tool. Actors use act(),
// never app globals or source. The root keeps the evaluator outside actor prompts.
async (page) => {
 const base='http://127.0.0.1:8821',run='ui-agent-2026-11-14';
 if(page.__morzsaPilot)return {ready:true,run};
 const sessions=new Map(),families=new Map();
 const stateOf=p=>p.evaluate(()=>({stock:structuredClone(state.stock),cart:structuredClone(state.cart),history:structuredClone(state.history),custom:structuredClone(state.custom)}));
 async function snapshot(s){
  const view=await s.page.evaluate(()=>{
   const text=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode()){if(!node.textContent.trim()||node.parentElement.closest('script,style')||!node.parentElement.checkVisibility())continue;const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();if(r.width&&r.bottom>0&&r.top<innerHeight)text.push(node.textContent.trim())}
   document.querySelectorAll('[data-sim-ref]').forEach(e=>e.removeAttribute('data-sim-ref'));
   const controls=[];let id=0;
   const activeDialog=document.querySelector('dialog[open]');
   for(const e of (activeDialog||document).querySelectorAll('button,input,textarea,select,summary,a[href]')){const r=e.getBoundingClientRect(),style=getComputedStyle(e);if(!e.checkVisibility()||!r.width||!r.height||r.bottom<=0||r.top>=innerHeight||style.visibility==='hidden'||style.display==='none')continue;const ref=String(++id);e.setAttribute('data-sim-ref',ref);controls.push({ref,role:e.tagName.toLowerCase(),label:e.getAttribute('aria-label')||e.labels?.[0]?.innerText||e.innerText||e.placeholder||e.title||'',type:e.type||'',value:e.value||'',disabled:!!e.disabled,...(e.tagName==='SELECT'?{options:[...e.options].map(o=>({value:o.value,label:o.text}))}:{})})}
   return {text:text.join(' · ').slice(0,4500),controls,viewport:{width:innerWidth,height:innerHeight},scrollY};
  });return {...view,actor:s.actor,actions:s.actions,calls:s.calls,maxActions:20,maxCalls:18};
 }
 async function record(s,event){await s.page.request.post(base+'/sim-log',{data:{run,actor:s.actor,at:new Date().toISOString(),...event}})}
 const pilot={run,
  async validateSnapshot(actor){
   const s=sessions.get(actor);if(!s)throw Error('Actor not initialized');
   const view=await snapshot(s);
   const invalid=await s.page.evaluate(()=>[...document.querySelectorAll('[data-sim-ref]')].filter(e=>document.querySelectorAll('[data-sim-ref="'+e.getAttribute('data-sim-ref')+'"]').length!==1).length);
   return {actor,controls:view.controls.length,invalidRefs:invalid,valid:invalid===0};
  },
  async addFamily(family){
   if(families.has(family))return {actors:[family+'-a',family+'-b']};
   const context=await page.context().browser().newContext({viewport:{width:390,height:844},locale:'hu-HU',isMobile:true,hasTouch:true});
   await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());families.set(family,context);
   for(const member of ['a','b']){
    const actor=family+'-'+member,p=await context.newPage();
    await p.addInitScript(({actor})=>{
     // Native storage events are an explicit simulated shared transport. Real
     // Supabase/RLS/concurrency remain independently checked by SQL replay.
     document.addEventListener('DOMContentLoaded',()=>{household.userId=()=>actor;window.dispatchEvent(new Event('morzsa-auth-change'))});
     window.addEventListener('storage',e=>{if(e.key==='morzsa-v2'&&e.newValue){state=JSON.parse(e.newValue);if(!document.querySelector('dialog[open]'))render()}});
    },{actor});
    await p.goto(base+'/?ui-agent='+actor+(family==='F'&&member==='a'?'&intro':''),{waitUntil:'domcontentloaded'});
    const s={actor,page:p,actions:0,calls:0};sessions.set(actor,s);await record(s,{operation:'initial',after:await stateOf(p)});
   }return {actors:[family+'-a',family+'-b']};
  },
  async act(actor,operation,ref='',value=''){
   const s=sessions.get(actor);if(!s)throw Error('Actor not initialized');
   if(operation==='finish'){await record(s,{operation:'finish',outcome:value,after:await stateOf(s.page),actions:s.actions,calls:s.calls});return {saved:true,actor,actions:s.actions,calls:s.calls}}
   if(s.calls>=18||s.actions>=20)return {budgetReached:true,actor,actions:s.actions,calls:s.calls};s.calls++;
   const before=await stateOf(s.page),started=Date.now();let error=null;
   try{
    if(operation==='observe'){}
    else if(operation==='screenshot'){await s.page.screenshot({path:'/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/simulation/runs/'+run+'/'+actor+'/'+String(s.calls).padStart(2,'0')+'.png'})}
    else{ s.actions++;const target=s.page.locator('[data-sim-ref="'+ref+'"]');
     if(operation==='click')await target.click({timeout:5000});
     else if(operation==='fill')await target.fill(String(value),{timeout:5000});
     else if(operation==='select')await target.selectOption(String(value),{timeout:5000});
     else if(operation==='press')await target.press(String(value||'Enter'),{timeout:5000});
     else if(operation==='scroll')await s.page.mouse.wheel(0,Number(value)||500);
     else if(operation==='reload')await s.page.reload({waitUntil:'domcontentloaded'});
     else throw Error('Unsupported browser operation');
    }
   }catch(e){error=String(e.message).slice(0,700)}
   const after=await stateOf(s.page),view=await snapshot(s);
   await record(s,{operation,ref,value,before,after,error,toolMs:Date.now()-started,view,actions:s.actions,calls:s.calls});
   return {error,...view,...(operation==='screenshot'?{screenshot:'/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/simulation/runs/'+run+'/'+actor+'/'+String(s.calls).padStart(2,'0')+'.png'}:{})};
  },
  async closeFamily(family){await families.get(family)?.close();families.delete(family);return {closed:family}}
 };
 page.__morzsaPilot=pilot;return {ready:true,run,base};
}
