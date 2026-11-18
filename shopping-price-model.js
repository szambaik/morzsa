const ShoppingPriceModel=(()=>{
 const Data=typeof ShoppingPriceData==='undefined'?require('./shopping-price-data'):ShoppingPriceData;
 const dimensions={kg:['mass',1000],g:['mass',1],l:['volume',1000],ml:['volume',1],db:['count',1]};
 function estimate(item,{resolve=n=>n,unitFor=()=> 'db'}={}){
  const product=Data.products[resolve(item.name)],quantity=item.quantity??1,unit=item.unit||unitFor(item.name);
  if(!product)return {known:false,reason:'product'};
  if(!Number.isFinite(quantity)||quantity<=0||quantity>999)return {known:false,reason:'quantity'};
  const base=dimensions[product.basis.unit],direct=dimensions[unit],pack=product.packs[unit];
  let ratio,assumption=null;
  if(direct&&direct[0]===base[0])ratio=quantity*direct[1]/(product.basis.quantity*base[1]);
  else if(pack){const packed=dimensions[pack.unit];ratio=quantity*pack.quantity*packed[1]/(product.basis.quantity*base[1]);assumption={...pack,per:unit}}
  else return {known:false,reason:'unit'};
  const mean=product.mean*ratio;
  return {known:true,low:Math.floor(mean*Data.rangeFactor[0]/10)*10,high:Math.ceil(mean*Data.rangeFactor[1]/10)*10,mean,assumption,sourceCode:product.sourceCode};
 }
 function total(items,options){const quotes=items.map(i=>estimate(i,options)),known=quotes.filter(q=>q.known);return {count:items.length,known:known.length,missing:quotes.length-known.length,low:known.reduce((n,q)=>n+q.low,0),high:known.reduce((n,q)=>n+q.high,0)}}
 function range(value,language='hu'){return value.low.toLocaleString(language==='en'?'en-GB':'hu-HU')+'–'+value.high.toLocaleString(language==='en'?'en-GB':'hu-HU')+' Ft'}
 return {estimate,total,range,source:Data};
})();
if(typeof module!=='undefined')module.exports=ShoppingPriceModel;
