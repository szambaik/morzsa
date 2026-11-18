window.ShoppingPrices=(()=>{
 const M=ShoppingPriceModel,say=(hu,en)=>language==='en'?en:hu;
 const options=()=>({resolve:productIdentity.resolve,unitFor:productUnit});
 function row(item){
  const value=M.estimate(item,options());
  if(!value.known)return '<small class="shopping-price is-unknown" data-price>'+say(value.reason==='unit'?'Árhoz pontosítsd az egységet':'Nincs árbecslés',value.reason==='unit'?'Choose a unit for a price estimate':'No price estimate')+'</small>';
  const assumption=value.assumption,pack=assumption?' · '+say('kb. ','about ')+QuantityModel.format(assumption.quantity,assumption.unit,language)+'/'+QuantityModel.label(assumption.per,language):'';
  return '<small class="shopping-price" data-price>'+say('Becsült: ','Estimated: ')+M.range(value,language)+esc(pack)+'</small>';
 }
 function summary(){
  const t=M.total(state.cart,options());if(!t.count)return '';
  const pending=M.total(state.cart.filter(i=>!i.done),options());
  return '<details class="shopping-price-summary" data-no-translate><summary><span>'+say(t.missing?'A lista becsült részösszege':'A lista becsült összege',t.missing?'Estimated list subtotal':'Estimated list total')+'</span><strong>'+(t.known?M.range(t,language):say('Még nincs becslés','No estimate yet'))+'</strong><span aria-hidden="true">⌄</span></summary><div><p>'+t.known+'/'+t.count+say(' tételhez van árbecslés.',' items have price estimates.')+(t.missing?' '+t.missing+say(' tétel nincs az összegben.',' items are excluded from the subtotal.'):'')+'</p>'+(pending.count&&pending.known?'<p>'+say('Még megvásárolandó, ismert árú tételek: ','Remaining items with an estimate: ')+M.range(pending,language)+'</p>':'')+'<p>'+say('Tájékoztató sáv a KSH 2025-ös országos átlagáraiból, ±30% ráhagyással. Nem aktuális bolti árajánlat. A feltételezett kiszerelés a tételnél látható.','Indicative range based on KSH national average prices for 2025, with a ±30% allowance. These are not current store quotes. Assumed pack sizes are shown on each item.')+'</p><a href="'+M.source.sourceUrl+'" target="_blank" rel="noopener noreferrer">'+say('Árbecslés forrása: KSH','Price baseline: KSH')+'</a></div></details>';
 }
 function mount(){
  const old=main.querySelector('.shopping-price-summary'),markup=summary();
  if(old){if(old.outerHTML.replace(' open=""','')!==markup){const open=old.open;old.outerHTML=markup;const fresh=main.querySelector('.shopping-price-summary');if(fresh)fresh.open=open}return}
  if(markup)(main.querySelector('.shopping-mode-top')||main.querySelector('.pantry-heading'))?.insertAdjacentHTML('afterend',markup);
 }
 return {row,mount};
})();
