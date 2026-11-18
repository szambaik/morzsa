// Display labels are localized; persisted unit codes and RPC limits stay unchanged.
const QuantityModel=(()=>{
 const codes=['db','kg','g','l','ml','csomag','doboz','üveg','pohár'];
 const labels={db:'pcs',csomag:'pack',doboz:'box',üveg:'bottle',pohár:'cup',tk:'tsp',ek:'tbsp'};
 const label=(unit,language='hu')=>language==='en'?(labels[unit]||unit):unit;
 function parse(value){const s=String(value??'').trim().replace(',','.');return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)?Number(s):NaN}
 function normalize(value,unit){
  let quantity=parse(value);if(!Number.isFinite(quantity)||quantity<=0||quantity>999||!codes.includes(unit))return null;
  if(quantity<1&&['l','kg'].includes(unit)){quantity=Math.round(quantity*1000*1e6)/1e6;unit=unit==='l'?'ml':'g'}
  return quantity>=1&&quantity<=999?{quantity,unit}:null;
 }
 function format(quantity,unit,language='hu'){return Number(quantity).toLocaleString(language==='en'?'en-GB':'hu-HU',{maximumFractionDigits:6})+' '+label(unit,language)}
 const step=unit=>unit==='g'?50:unit==='ml'?100:1;
 function adjust(quantity,unit,direction){
  if(![-1,1].includes(direction)||!Number.isFinite(quantity)||!codes.includes(unit))return null;
  let value=Math.round((quantity+direction*step(unit))*1e6)/1e6;
  if(value>=1000&&['g','ml'].includes(unit)){value/=1000;unit=unit==='g'?'kg':'l'}
  return normalize(value,unit);
 }
 function recipeAmount(text,language='hu'){
  if(language!=='en')return String(text);return String(text).replace(/(\d),(\d)/g,'$1.$2').replace(/(^|\s)(db|darab|csomag|doboz|üveg|pohár|tk|ek)(?=$|[\s.,/])/gu,(_,space,unit)=>space+label(unit==='darab'?'db':unit,'en')).replace(/\bnagy\b/g,'large').replace(/\bközepes\b/g,'medium').replace(/\bkis\b/g,'small');
 }
 return {codes,label,parse,normalize,format,recipeAmount,step,adjust};
})();
if(typeof module!=='undefined')module.exports=QuantityModel;
