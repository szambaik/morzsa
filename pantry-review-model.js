// Review age measures confidence in presence, never food safety or expiry.
const PantryReviewModel=(()=>{
 const day=86400000;
 function interval(category){if(['Zöldségek','Gyümölcsök','Pékáru'].includes(category))return 5;if(['Tejtermék és tojás','Hús és felvágott','Hal és tengeri','Növényi alapok'].includes(category))return 7;if(category==='Fagyasztott')return 30;return 60}
 function due(stock,checks,categoryFor,excluded=new Set(),now=Date.now()){
  return Object.keys(stock).filter(name=>stock[name]>0&&!excluded.has(categoryFor(name))).map(name=>{const at=Date.parse(checks[name]?.last_confirmed_at||checks[name]||'');return {name,unknown:!Number.isFinite(at),at,days:interval(categoryFor(name))}}).filter(x=>x.unknown||now-x.at>=x.days*day).sort((a,b)=>Number(b.unknown)-Number(a.unknown)||(a.at||0)-(b.at||0));
 }
 return {interval,due};
})();
if(typeof module!=='undefined')module.exports=PantryReviewModel;
