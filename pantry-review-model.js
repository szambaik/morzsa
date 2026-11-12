// Review age measures confidence in presence, never food safety or expiry.
const PantryReviewModel=(()=>{
 const day=86400000;
 function interval(category){if(['Zöldségek','Gyümölcsök','Pékáru'].includes(category))return 5;if(['Tejtermék és tojás','Hús és felvágott','Hal és tengeri','Növényi alapok'].includes(category))return 7;if(category==='Fagyasztott')return 30;return 60}
 // Reminder windows restart at the latest confirmation; these are not expiry dates.
 const cycles={'Kenyér':1,'Zsemle':1,'Kifli':1,'Tej':1,'Joghurt':2,'Tejföl':7,'Tojás':10,'Vaj':21,'Sajt':10,'Paradicsom':5,'Paprika':7,'Uborka':5,'Saláta':4,'Banán':5,'Alma':10,'Krumpli':21,'Hagyma':21,'Fokhagyma':30,'Csirkemell':5,'Csirkecomb':5,'Sonka':5,'Rizs':45,'Tészta':30,'Olaj':60,'Liszt':60,'Cukor':90,'Só':120,'Kávé':21};
 function due(stock,checks,categoryFor,excluded=new Set(),now=Date.now(),priorityFor=()=>9999){
  return Object.keys(stock).filter(name=>stock[name]>0&&!excluded.has(categoryFor(name))).map(name=>{
   const at=Date.parse(checks[name]?.last_confirmed_at||checks[name]||''),unknown=!Number.isFinite(at),days=cycles[name]||interval(categoryFor(name)),age=unknown?null:Math.max(0,(now-at)/day),importance=Math.max(0,1-Math.min(100,priorityFor(name))/100);
   // Relative overdue age dominates, with a bounded preference for daily basics.
   const score=(unknown?1.5:age/days)+Math.min(1,7/days)+importance*.65;
   return {name,unknown,at,days,age,score};
  }).filter(x=>x.unknown||x.age>=x.days).sort((a,b)=>b.score-a.score||(a.at||0)-(b.at||0)||a.name.localeCompare(b.name));
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
