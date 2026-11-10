// Review age measures confidence in presence, never food safety or expiry.
const PantryReviewModel=(()=>{
 const day=86400000;
 function interval(category){if(['Zöldségek','Gyümölcsök','Pékáru'].includes(category))return 5;if(['Tejtermék és tojás','Hús és felvágott','Hal és tengeri','Növényi alapok'].includes(category))return 7;if(category==='Fagyasztott')return 30;return 60}
 function due(stock,checks,categoryFor,excluded=new Set(),now=Date.now()){
  return Object.keys(stock).filter(name=>stock[name]>0&&!excluded.has(categoryFor(name))).map(name=>{const at=Date.parse(checks[name]?.last_confirmed_at||checks[name]||'');return {name,unknown:!Number.isFinite(at),at,days:interval(categoryFor(name))}}).filter(x=>x.unknown||now-x.at>=x.days*day).sort((a,b)=>a.days-b.days||Number(b.unknown)-Number(a.unknown)||(a.at||0)-(b.at||0));
 }
 function removalPlan(current,names,alsoList,unitFor){
  const next=JSON.parse(JSON.stringify(current)),changes=[];
  for(const name of [...new Set(names)]){
   if(!(current.stock[name]>0))continue;
   next.stock[name]=0;changes.push({bucket:'stock',key:name,before:current.stock[name],after:0});
   if(alsoList){const index=next.cart.findIndex(x=>x.name===name),before=index>=0?next.cart[index]:undefined;
    const after=before?{...before,done:false}:{name,quantity:1,unit:unitFor(name),done:false,source:'Készletellenőrzés'};
    if(JSON.stringify(before)!==JSON.stringify(after)){if(index>=0)next.cart[index]=after;else next.cart.push(after);changes.push({bucket:'cart',key:name,before,after})}
   }
  }
  return {next,changes};
 }
 return {interval,due,removalPlan};
})();
if(typeof module!=='undefined')module.exports=PantryReviewModel;
