async(page)=>{
 const browser=page.context().browser(),ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errors=[];
 const check=(ok,m)=>{if(!ok)throw Error(m)};p.on('pageerror',e=>errors.push(e.message));
 await ctx.route('https://cbgcugshwivxpaurzyqq.supabase.co/**',r=>r.fulfill({json:[]}));
 await ctx.addInitScript(()=>localStorage.setItem('morzsa-v1',JSON.stringify({stock:{Tej:2,Alma:2,Rizs:2},cart:[],custom:[],history:[],likes:[],skips:[],chats:{}})));
 try{
  await p.goto('http://localhost:8780/');await p.locator('nav [data-page=overview]').click();await p.locator('#pantry-review-entry').waitFor();
  check(await p.evaluate(()=>Object.keys(state.stock).length===3&&PantryReview.uncertain().length===3),'legacy stock preserved and unknown');
  await p.locator('#pantry-review-entry').click();await p.locator('[data-review=keep]').click();
  check(await p.evaluate(()=>state.stock.Tej===2&&!PantryReview.uncertain().includes('Tej')),'confirmation keeps stock');
  await p.locator('[data-review=list]').click();
  check(await p.evaluate(()=>state.stock.Alma===0&&state.cart.filter(i=>i.name==='Alma').length===1),'used up adds once and clears presence');
  await p.locator('[data-review=skip]').click();check(await p.evaluate(()=>state.stock.Rizs===2&&PantryReview.uncertain().includes('Rizs')),'skip preserves unknown');
  await p.reload();await p.locator('nav [data-page=overview]').click();check(await p.evaluate(()=>!PantryReview.uncertain().includes('Tej')&&state.cart.some(i=>i.name==='Alma')),'local metadata and list persisted');
  await p.locator('#pantry-review-entry').click();await p.screenshot({path:'/tmp/morzsa-review-mobile.png'});await p.locator('[data-review=gone]').click();check(await p.evaluate(()=>state.stock.Rizs===0),'gone removes presence');
  check(errors.length===0,errors.join('\n'));return {passed:true,checks:6,errors};
 }finally{await ctx.close()}
}
