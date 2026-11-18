import {rows} from './store.mjs';
import {fail,uuid} from './engine.mjs';
const publicFields={households:['id','name','owner_id','created_at'],household_members:['household_id','user_id'],household_records:['bucket','key','value','revision','household_id'],household_pantry_reviews:['household_id','product_name','last_confirmed_at','stock_revision','confirmed_by']};
const householdTables=new Set(['household_records','household_members','household_pantry_reviews','household_kitchen_preferences','household_kitchen_events','household_shopping_sessions','household_shopping_routes','household_recipe_entries','household_member_names']);
const privateTables=new Set(['recipe_library_entries','recipe_documents','conversation_user_state']);
const fields=(select)=>{const result=[];let level=0,start=0;for(let i=0;i<select.length;i++){if(select[i]==='(')level++;if(select[i]===')')level--;if(select[i]===','&&!level){result.push(select.slice(start,i));start=i+1;}}result.push(select.slice(start));return result;};
const value=v=>v==='true'?true:v==='false'?false:v==='null'?null:v;
function matches(row,k,filter){const dot=filter.indexOf('.'),op=filter.slice(0,dot),v=filter.slice(dot+1),actual=row[k];if(op==='eq')return String(actual)===v;if(op==='is')return actual===value(v);if(op==='not'&&v==='is.null')return actual!=null;if(op==='gte')return String(actual)>=v;if(op==='lt')return String(actual)<v;if(op==='in'&&v.startsWith('(')&&v.endsWith(')'))return v.slice(1,-1).split(',').includes(String(actual));fail(400,'Unsupported filter');}
export async function readTable(engine,name,params){
 let data=[];
 if(name==='households')data=await engine.households();
 else if(householdTables.has(name)){const requested=params.get('household_id');const homes=requested?.startsWith('eq.')?[{id:requested.slice(3)}]:await engine.households();for(const home of homes){const h=await engine.household(home.id);data.push(...rows(h,name));}}
 else if(privateTables.has(name)){if(name==='recipe_documents'){const ids=params.get('id');if(ids?.startsWith('eq.'))data=[(await engine.recipe(ids.slice(3))).r];else if(ids?.startsWith('in.(')){for(const rid of ids.slice(4,-1).split(','))data.push((await engine.recipe(rid)).r);}else{for(const stub of rows(await engine.user(),'recipe_documents'))data.push((await engine.recipe(stub.id)).r);}}
  else data=rows(await engine.user(),name).filter(r=>r.user_id===engine.uid);}
 else if(name==='conversation_messages'||name==='conversation_recipe_links'){const cid=params.get('conversation_id')?.slice(3);if(!uuid(cid))fail(400,'Conversation filter required');data=rows((await engine.conversation(cid)).s,name);}
 else if(name==='conversations'){for(const item of await engine.index(0)){const {c}=await engine.conversation(item.id);data.push({...c,metadata:item.metadata});}}
 else if(name==='recipe_asset_jobs'){const rid=params.get('recipe_id')?.slice(3);data=rows((await engine.recipe(rid)).s,name);}
 else fail(404,'Table unavailable');
 for(const [k,v] of params)if(!['select','order','limit','offset'].includes(k)){if(k.includes('(')||k==='or')fail(400,'Unsupported filter');data=data.filter(row=>matches(row,k,v));}
 const order=params.get('order');if(order){const keys=order.split(',').map(k=>k.split('.'));data.sort((a,b)=>{for(const [key,direction] of keys){const av=a[key],bv=b[key],c=typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''));if(c)return direction==='desc'?-c:c;}return 0;});}
 const offset=Math.max(0,Number(params.get('offset')??0)),limit=Math.min(1000,Math.max(0,Number(params.get('limit')??1000)));if(!Number.isInteger(offset)||!Number.isInteger(limit))fail(400,'Invalid page');data=data.slice(offset,offset+limit);
 const select=params.get('select')??'*',selected=fields(select),result=[];for(const row of data){const out={};for(const field of selected){if(field==='*'){Object.assign(out,row);continue;}if(field.startsWith('recipe_documents(')){const {r}=await engine.recipe(row.recipe_id);out.recipe_documents=Object.fromEntries(fields(field.slice(17,-1)).filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]]));continue;}if(field.startsWith('households(')){const h=await engine.household(row.household_id),house=rows(h,'households')[0];out.households=Object.fromEntries(fields(field.slice(11,-1)).filter(k=>Object.hasOwn(house,k)).map(k=>[k,house[k]]));continue;}if(Object.hasOwn(row,field))out[field]=row[field];}result.push(out);}return result;
}
