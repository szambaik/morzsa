import {allowedOrigins} from './origins.mjs';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,QueryCommand} from '@aws-sdk/lib-dynamodb';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {Transaction} from './store.mjs';
import {Engine} from './engine.mjs';
import {readTable} from './rest.mjs';
import {withTelemetry} from './telemetry.mjs';
import {wrappedMediaURL,unwrapMediaURL} from './media.mjs';

const config={region:process.env.AWS_REGION,maxAttempts:3};
const db=DynamoDBDocumentClient.from(new DynamoDBClient(config),{marshallOptions:{removeUndefinedValues:true}});
const s3=new S3Client(config);
const table=process.env.DATA_TABLE;
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function get(PK,SK){const r=await db.send(new GetCommand({TableName:table,Key:{PK,SK},ConsistentRead:true}));return r.Item;}
async function query(PK,prefix){const match=/^APP#([^#]+)#([HUCRG]#[a-z0-9-]+)$/.exec(PK);if(match)return (await new Transaction(match[1]).get(match[2])).tables[prefix.replace(/#$/,'')]??[];const items=[];let cursor;do{const page=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'PK = :pk AND begins_with(SK, :sk)',ExpressionAttributeValues:{':pk':PK,':sk':prefix},ConsistentRead:true,ExclusiveStartKey:cursor}));items.push(...(page.Items??[]));cursor=page.LastEvaluatedKey;}while(cursor);return items.map(x=>JSON.parse(x.record));}
const store={get,query};
export function createHandler({store,presign,transaction=dataset=>new Transaction(dataset),writeEnabled=process.env.WRITE_ENABLED==='true',region=process.env.AWS_REGION,pool=process.env.USER_POOL,client=process.env.APP_CLIENT}) {
 return async event=>{
  const origin=event.headers?.origin??'',allowed=allowedOrigins;
  const cors=origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS',Vary:'Origin'}:{};
  try {
   const path=event.rawPath??'/',method=event.requestContext?.http?.method??'GET';
   const answer=body=>({statusCode:200,headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
   if(origin&&!allowed.includes(origin))fail(403,'Origin denied');
   if(method==='OPTIONS')return {statusCode:204,headers:cors,body:''};
   if(path==='/health'&&method==='GET')return answer({provider:'aws',database:'dynamodb',mode:writeEnabled?'migration-preview':'migration-read-only',region});
   if(path.startsWith('/public/')){
    const meta=await store.get('META#CURRENT','DATASET');if(!meta?.dataset)fail(503,'Migration snapshot not ready');
    const engine=new Engine(transaction(meta.dataset),{userId:'00000000-0000-4000-8000-000000000000'});
    if(method==='POST'&&path==='/public/feed')return answer(await engine.rpc('recipe_feed',JSON.parse(event.body??'{}')));
    if(method==='GET'&&path==='/public/recipes'){const params=new URLSearchParams(event.rawQueryString??'');const rid=params.get('id')?.replace(/^eq\./,'');const {r}=await engine.recipe(rid);if(!r.published)fail(403,'Recipe access denied');return answer(await readTable(engine,'recipe_documents',params));}
    if(method==='POST'&&path==='/public/recipe-image'){const input=JSON.parse(event.body??'{}'),{r,s}=await engine.recipe(input.recipeId);if(!r.published)fail(403,'Recipe access denied');const step=input.step??-1,j=s.tables.recipe_asset_jobs?.find(j=>j.step===step&&j.state==='ready');if(!j)return answer({status:'missing'});return answer({status:'ready',canReplace:false,url:wrappedMediaURL('https://'+event.requestContext.domainName,j.bucket,j.thumbnail_path||j.asset_path,await presign('objects/'+j.bucket+'/'+(j.thumbnail_path||j.asset_path))),expiresAt:Date.now()+240000});}
    if(method==='GET'&&path==='/public/plus-status')return answer({configured:true,enabled:false,supportsImages:true,supportsStreaming:true,voiceSeconds:110});
    fail(404,'Public endpoint unavailable');
   }
   if(method==='GET'&&path.startsWith('/storage/v1/object/sign/')){
    const objectPath=decodeURIComponent(path.slice('/storage/v1/object/sign/'.length));let location;
    try{location=unwrapMediaURL(event.queryStringParameters?.token,process.env.MEDIA_BUCKET,objectPath);}catch{fail(403,'Invalid media link');}
    return {statusCode:302,headers:{...cors,Location:location,'Cache-Control':'private, no-store'},body:''};
   }
   if(method==='GET'&&path.startsWith('/storage/v1/object/public/recipe-catalog/')){
    const asset=decodeURIComponent(path.slice('/storage/v1/object/public/recipe-catalog/'.length)),rid=asset.split('/')[0];if(!uuid(rid))fail(404,'Image unavailable');
    const meta=await store.get('META#CURRENT','DATASET');if(!meta?.dataset)fail(503,'Migration snapshot not ready');
    const state=await transaction(meta.dataset).get('R#'+rid);
    if(!state.tables.recipe_documents?.some(r=>r.id===rid&&r.published)||!state.tables.recipe_asset_jobs?.some(j=>j.state==='ready'&&j.bucket==='recipe-catalog'&&[j.asset_path,j.thumbnail_path].includes(asset)))fail(404,'Image unavailable');
    return {statusCode:302,headers:{...cors,Location:await presign('objects/recipe-catalog/'+asset),'Cache-Control':'public, max-age=240'},body:''};
   }
   const claims=event.requestContext?.authorizer?.jwt?.claims;
   if(!claims||claims.token_use!=='access'||claims.client_id!==client||claims.iss!=='https://cognito-idp.'+region+'.amazonaws.com/'+pool||!uuid(claims.sub))fail(401,'Sign in required');
   const profile=await store.get('IDENTITY#'+claims.sub,'PROFILE');
   if(!profile||profile.disabled||!uuid(profile.userId))fail(403,'Account migration not available');
   const meta=await store.get('META#CURRENT','DATASET');
   if(!['READY_READ_ONLY','READY_PREVIEW'].includes(meta?.state)||!meta.dataset)fail(503,'Migration snapshot not ready');
   if(method==='POST'&&path.startsWith('/storage/v1/object/')){
    const signing=path.startsWith('/storage/v1/object/sign/chat-media/'),prefix=signing?'/storage/v1/object/sign/chat-media/':'/storage/v1/object/chat-media/';
    if(!path.startsWith(prefix))fail(403,'Upload denied');const objectPath=decodeURIComponent(path.slice(prefix.length)),parts=objectPath.split('/');
    if(parts.length!==3||parts[0]!==profile.userId||!uuid(parts[1])||!uuid(parts[2].replace(/\.jpg$/,''))||!parts[2].endsWith('.jpg'))fail(403,'Upload denied');
    await new Engine(transaction(meta.dataset),profile).conversation(parts[1],false,true);
    const objectKey='objects/chat-media/'+objectPath;
    if(signing){const signedURL=wrappedMediaURL('', 'chat-media',objectPath,await presign(objectKey)).slice('/storage/v1'.length);return answer({signedURL});}
    if(!writeEnabled||meta.state!=='READY_PREVIEW')fail(409,'AWS_READ_ONLY_MIGRATION');
    const bytes=Buffer.from(event.body??'',event.isBase64Encoded?'base64':'utf8');if(bytes.length>3000000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)fail(400,'Invalid JPEG');
    try{await s3.send(new PutObjectCommand({Bucket:process.env.MEDIA_BUCKET,Key:objectKey,Body:bytes,ContentType:'image/jpeg',IfNoneMatch:'*'}));}catch(error){if(error.name!=='PreconditionFailed')throw error;}return answer({Key:'chat-media/'+objectPath});
   }
   if(path.startsWith('/rest/v1/')){
    const tx=transaction(meta.dataset),engine=new Engine(tx,profile),url=new URL(path+'?'+(event.rawQueryString??''),'https://aws.invalid');
    if(method==='GET')return answer(await readTable(engine,path.slice(9),url.searchParams));
    if(method!=='POST'||!path.startsWith('/rest/v1/rpc/'))fail(405,'Direct table mutations are not supported');
    const readRPCs=['conversation_index','conversation_page','recipe_feed','household_recipe_index','household_collaboration_snapshot','list_household_email_invites','list_sent_household_invites'];
    if((!writeEnabled||meta.state!=='READY_PREVIEW')&&!readRPCs.includes(path.slice(13)))fail(409,'AWS_READ_ONLY_MIGRATION');
    if((event.body??'').length>5500000)fail(413,'Request too large');
    let args;try{args=JSON.parse(event.body??'{}');}catch{fail(400,'Invalid JSON');}
    const result=await engine.rpc(path.slice(13),args);await tx.commit();return answer(result);
   }
   if(method!=='GET')fail(409,'AWS_READ_ONLY_MIGRATION');
   const root='APP#'+meta.dataset+'#',uid=profile.userId;
   const members=await store.query(root+'U#'+uid,'household_members#');
   const inHousehold=hid=>members.some(m=>m.household_id===hid&&m.user_id===uid);
   const rows=(scope,name)=>store.query(root+scope,name+'#');
   const first=async(scope,name,id)=>{const records=await rows(scope,name);return id?records.find(r=>r.id===id):records[0];};
   const conversation=async cid=>{
    if(!uuid(cid))fail(400,'Invalid conversation');
    const c=await first('C#'+cid,'conversations');
    if(!c||c.deleted_at)fail(404,'Conversation unavailable');
    const shares=await rows('C#'+cid,'conversation_shares');
    if(c.owner_id!==uid&&!shares.some(s=>inHousehold(s.household_id)))fail(403,'Conversation access denied');
    return c;
   };
   const recipe=async rid=>{
    if(!uuid(rid))fail(400,'Invalid recipe');
    const r=await first('R#'+rid,'recipe_documents');
    if(!r)fail(404,'Recipe unavailable');
    if(r.published||r.owner_id===uid)return r;
    for(const m of members){if((await rows('H#'+m.household_id,'household_recipe_entries')).some(e=>e.recipe_id===rid))return r;}
    const links=await rows('R#'+rid,'conversation_recipe_links');
    for(const link of links){try{await conversation(link.conversation_id);return r;}catch(error){if(![403,404].includes(error.status))throw error;}}
    fail(403,'Recipe access denied');
   };
   if(path==='/me')return answer({id:uid,provider:'aws',mode:'migration-read-only'});
   if(path==='/households')return answer((await Promise.all(members.map(m=>first('H#'+m.household_id,'households')))).filter(Boolean));
   const parts=path.split('/').filter(Boolean);
   if(parts[0]==='households'&&parts[2]==='snapshot'&&parts.length===3){
    const hid=parts[1];if(!uuid(hid))fail(400,'Invalid household');if(!inHousehold(hid))fail(403,'Household access denied');
    const names=['households','household_records','household_members','household_pantry_reviews','household_kitchen_preferences','household_kitchen_events','household_shopping_sessions','household_shopping_routes','household_recipe_entries','household_member_names'];
    const data=await Promise.all(names.map(n=>rows('H#'+hid,n)));return answer({householdId:hid,data:Object.fromEntries(names.map((n,i)=>[n,data[i]])),sourceSnapshot:meta.exportedAt});
   }
   if(path==='/conversations'){
    const own=await rows('U#'+uid,'conversations');const all=new Map(own.map(c=>[c.id,c]));
    for(const m of members)for(const share of await rows('H#'+m.household_id,'conversation_shares')){const c=await first('C#'+share.conversation_id,'conversations');if(c)all.set(c.id,c);}
    return answer([...all.values()].filter(c=>!c.deleted_at).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)));
   }
   if(parts[0]==='conversations'&&parts.length===2){const cid=parts[1],c=await conversation(cid);return answer({conversation:c,messages:(await rows('C#'+cid,'conversation_messages')).sort((a,b)=>a.sequence-b.sequence),recipeLinks:await rows('C#'+cid,'conversation_recipe_links')});}
   if(path==='/recipes/feed')return answer(await rows('FEED','recipe_documents'));
   if(parts[0]==='recipes'&&parts.length===2)return answer(await recipe(parts[1]));
   if(parts[0]==='recipes'&&parts[2]==='assets'&&parts.length===4){
    const rid=parts[1];await recipe(rid);const step=Number(parts[3]);if(!Number.isInteger(step)||step < -1||step>1000)fail(400,'Invalid recipe step');
    const job=(await rows('R#'+rid,'recipe_asset_jobs')).find(j=>j.step===step);
    if(job?.state!=='ready'||!job.asset_path)fail(404,'Image generation is pending migration');
    const path=job.thumbnail_path||job.asset_path,key='objects/'+job.bucket+'/'+path;
    return answer({state:'ready',url:await presign(key),expiresIn:300,model:job.model});
   }
   fail(404,'AWS endpoint not implemented');
  }catch(error){return {statusCode:error.status??503,headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, no-store'},body:JSON.stringify({error:error.status?error.message:'AWS service temporarily unavailable'})};}
 };
}
export const handler=withTelemetry(createHandler({store,presign:key=>getSignedUrl(s3,new GetObjectCommand({Bucket:process.env.MEDIA_BUCKET,Key:key}),{expiresIn:300})}),'data');
