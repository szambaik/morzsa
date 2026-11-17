// Completed scalar fields from an unfinished JSON document, for display only.
// The complete response must still pass validOutput before saving or cooking.
export function recipePreviews(raw){
 if(typeof raw!=='string'||raw.length>50000)return [];
 let at=0;const missing=Symbol(),space=()=>{while(at<raw.length&&/\s/.test(raw[at]))at++};
 const value=(depth=0)=>{
  if(depth>12)throw Error('depth');space();const c=raw[at];if(c===undefined)return missing;
  if(c==='"'){
   const start=at++;
   while(at<raw.length){const ch=raw[at++];if(ch==='\\')at++;else if(ch==='"')return JSON.parse(raw.slice(start,at))}
   return missing;
  }
  if(c==='{'||c==='['){
   at++;const object=c==='{',out=object?Object.create(null):[],end=object?'}':']';space();if(raw[at]===end){at++;return out}
   while(at<raw.length){
    let key;
    if(object){space();if(raw[at]!== '"')throw Error('key');key=value(depth+1);if(key===missing)return out;space();if(at===raw.length)return out;if(raw[at++]!==':')throw Error('colon')}
    const item=value(depth+1);if(item!==missing){if(object){if(Object.hasOwn(out,key))throw Error('duplicate');out[key]=item}else out.push(item)}
    space();if(at>=raw.length)return out;if(raw[at]===end){at++;return out}if(raw[at++]!==',')throw Error('comma');
   }
   return out;
  }
  const start=at;while(at<raw.length&&!/[\s,}\]]/.test(raw[at]))at++;
  // A number at EOF could still become 2 -> 240; wait for its delimiter.
  if(at===raw.length)return missing;
  return JSON.parse(raw.slice(start,at));
 };
 try{
  const parsed=value();space();if(at<raw.length)return [];
  if(!Array.isArray(parsed?.recipes)||parsed.recipes.length>3)return [];
  return parsed.recipes.flatMap(r=>{
   if(!r||typeof r.title!=='string'||!r.title.trim()||r.title.length>100)return [];
   return [{title:r.title,...(typeof r.summary==='string'&&r.summary.length<=300?{summary:r.summary}:{}),...(Number.isInteger(r.minutes)&&r.minutes>=1&&r.minutes<=240?{minutes:r.minutes}:{}),...(Number.isInteger(r.servings)&&r.servings>=1&&r.servings<=24?{servings:r.servings}:{})}];
  });
 }catch{return []}
}
