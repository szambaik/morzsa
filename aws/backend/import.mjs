import {createHash} from 'node:crypto';
import {S3Client,GetObjectCommand,HeadObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,BatchWriteCommand,BatchGetCommand,GetCommand,PutCommand} from '@aws-sdk/lib-dynamodb';
import {CognitoIdentityProviderClient,AdminCreateUserCommand,AdminGetUserCommand,AdminSetUserPasswordCommand,CreateIdentityProviderCommand,UpdateIdentityProviderCommand,AdminLinkProviderForUserCommand} from '@aws-sdk/client-cognito-identity-provider';
import {SecretsManagerClient,PutSecretValueCommand} from '@aws-sdk/client-secrets-manager';
import {randomBytes} from 'node:crypto';
import {projectSnapshot} from './projection.mjs';
const options={region:process.env.AWS_REGION,maxAttempts:6};
const s3=new S3Client(options),db=DynamoDBDocumentClient.from(new DynamoDBClient(options),{marshallOptions:{removeUndefinedValues:true}}),auth=new CognitoIdentityProviderClient(options);
const table=process.env.DATA_TABLE,bucket=process.env.MEDIA_BUCKET,pool=process.env.USER_POOL;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function object(key){const r=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));return r.Body.transformToByteArray();}
async function put(item,extra={}){await db.send(new PutCommand({TableName:table,Item:item,...extra}));}
export async function handler(event) {
 if(event.action==='activate-preview'){
  if(!/^[a-f0-9]{64}$/.test(event.sha256??''))throw Error('Expected snapshot checksum required');
  const dataset=event.sha256.slice(0,24),status=(await db.send(new GetCommand({TableName:table,Key:{PK:'META#IMPORT#'+dataset,SK:'STATUS'},ConsistentRead:true}))).Item;
  if(status?.phase!=='COMPLETE'||status.sha256!==event.sha256)throw Error('Verified import required');
  const current=(await db.send(new GetCommand({TableName:table,Key:{PK:'META#CURRENT',SK:'DATASET'},ConsistentRead:true}))).Item;
  if(current?.dataset!==dataset)throw Error('Dataset mismatch');if(current.state==='READY_PREVIEW')return {state:current.state,dataset};
  await put({...current,state:'READY_PREVIEW'},{ConditionExpression:'#state = :readonly',ExpressionAttributeNames:{'#state':'state'},ExpressionAttributeValues:{':readonly':'READY_READ_ONLY'}});
  return {state:'READY_PREVIEW',dataset};
 }
 if(event.action==='configure-providers'){
  const settings=JSON.parse(Buffer.from(await object('migration/setup/providers.json')).toString('utf8'));
  await new SecretsManagerClient(options).send(new PutSecretValueCommand({SecretId:process.env.PROVIDER_SECRET,SecretString:JSON.stringify(settings)}));
  if(settings.GOOGLE_CLIENT_ID&&settings.GOOGLE_CLIENT_SECRET){
   const provider={UserPoolId:pool,ProviderName:'Google',ProviderDetails:{client_id:settings.GOOGLE_CLIENT_ID,client_secret:settings.GOOGLE_CLIENT_SECRET,authorize_scopes:'openid email profile'},AttributeMapping:{email:'email',email_verified:'email_verified'}};
   try{await auth.send(new CreateIdentityProviderCommand({...provider,ProviderType:'Google'}));}catch(error){if(error.name!=='DuplicateProviderException')throw error;await auth.send(new UpdateIdentityProviderCommand(provider));}
  }
  return {configured:Object.keys(settings).filter(k=>!!settings[k]),googleRedirect:process.env.AUTH_DOMAIN+'/oauth2/idpresponse'};
 }
 const sha=event.sha256;
 if(!/^[a-f0-9]{64}$/.test(sha??''))throw Error('Expected export SHA-256 required');
 const dataset=sha.slice(0,24),prefix='migration/'+dataset+'/';
 const checkpoint={PK:'META#IMPORT#'+dataset,SK:'STATUS',dataset,phase:'STARTED'};
 try{
  const current=await db.send(new GetCommand({TableName:table,Key:{PK:'META#CURRENT',SK:'DATASET'},ConsistentRead:true}));
  if(current.Item&&current.Item.state!=='READY_READ_ONLY')throw Error('Import cannot overwrite an active writable backend');
  const bytes=await object(prefix+'export.json');if(digest(bytes)!==sha)throw Error('Source snapshot checksum mismatch');
  const source=JSON.parse(Buffer.from(bytes).toString('utf8'));
  if(source.format!==1||source.project_ref!==process.env.SOURCE_PROJECT)throw Error('Wrong source project');
  const media=JSON.parse(Buffer.from(await object(prefix+'media-manifest.json')).toString('utf8'));
  if(media.projectRef!==source.project_ref||media.exportedAt!==source.exported_at||media.objects.length!==source.storage_objects.length)throw Error('Incomplete media manifest');
  await put({...checkpoint,phase:'VERIFY_MEDIA'});
  const pending=media.objects.slice();
  await Promise.all(Array.from({length:4},async()=>{while(pending.length){const o=pending.shift();if(!o.key.startsWith('objects/'+o.bucket+'/')||o.key!=='objects/'+o.bucket+'/'+o.path)throw Error('Invalid media key');const result=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:o.key,ChecksumMode:'ENABLED'}));if(result.ContentLength!==o.bytes||result.ChecksumSHA256!==Buffer.from(o.sha256,'hex').toString('base64'))throw Error('Migrated object checksum mismatch');}}));
  const plan=projectSnapshot(source,dataset);
  // Materialize entity heads once. Runtime reads never scan archive rows and
  // each future transaction writes a small DynamoDB revision pointer.
  const entities=new Map();
  for(const item of plan.items){if(!item.PK.startsWith('APP#'+dataset+'#')||item.PK.endsWith('#FEED'))continue;
   const state=entities.get(item.PK)??{tables:{}};
   if(item.SK==='STATE')Object.assign(state,JSON.parse(item.record));
   else{const tableName=item.SK.split('#')[0];(state.tables[tableName]??=[]).push(JSON.parse(item.record));}
   entities.set(item.PK,state);
  }
  plan.items=plan.items.filter(item=>item.SK!=='STATE');
  for(const [PK,state] of entities){const data=Buffer.from(JSON.stringify(state)),sha256=digest(data),objectKey='entities/'+dataset+'/initial/'+digest(Buffer.from(PK))+'.json';
   await s3.send(new PutObjectCommand({Bucket:bucket,Key:objectKey,Body:data,ContentType:'application/json',ChecksumSHA256:Buffer.from(sha256,'hex').toString('base64')}));
   plan.items.push({PK,SK:'STATE',revision:1,objectKey,sha256,record:JSON.stringify({initialized:true})});
  }
  for(let offset=0;offset<plan.items.length;offset+=25){
   let requests=plan.items.slice(offset,offset+25).map(Item=>({PutRequest:{Item}}));
   for(let attempt=0;requests.length;attempt++){
    if(attempt>12)throw Error('Import throttled; retry the same immutable snapshot');
    const r=await db.send(new BatchWriteCommand({RequestItems:{[table]:requests}}));requests=r.UnprocessedItems?.[table]??[];
    if(requests.length)await wait(Math.min(4000,100*2**attempt)+Math.random()*100);
   }
   if(offset%250===0)await put({...checkpoint,phase:'COPY_RECORDS',copied:Math.min(offset+25,plan.items.length),total:plan.items.length});
  }
  await put({...checkpoint,phase:'VERIFY_RECORDS',total:plan.items.length});
  // Every written record is read back and compared. This is migration integrity,
  // rather than a broad application regression suite.
  for(let offset=0;offset<plan.items.length;offset+=100){
   const expected=plan.items.slice(offset,offset+100),found=new Map();let keys=expected.map(({PK,SK})=>({PK,SK}));
   for(let attempt=0;keys.length;attempt++){
    if(attempt>12)throw Error('Verification throttled; retry the snapshot');
    const r=await db.send(new BatchGetCommand({RequestItems:{[table]:{Keys:keys,ConsistentRead:true}}}));
    for(const item of r.Responses?.[table]??[])found.set(JSON.stringify([item.PK,item.SK]),item.record);
    keys=r.UnprocessedKeys?.[table]?.Keys??[];if(keys.length)await wait(Math.min(4000,100*2**attempt));
   }
   if(expected.some(item=>found.get(JSON.stringify([item.PK,item.SK]))!==item.record))throw Error('DynamoDB record verification failed');
  }
  await put({...checkpoint,phase:'COPY_IDENTITIES'});let mapped=0,anonymous=0,unmapped=0;
  for(const user of source.auth_users){
   if(user.is_anonymous&&!user.email){anonymous++;continue;}
   if(!user.email||!user.email.includes('@')||!user.email.split('@')[1]?.includes('.')){unmapped++;continue;}
   const attributes=[{Name:'custom:app_user_id',Value:user.id}];
   if(user.email)attributes.push({Name:'email',Value:user.email},{Name:'email_verified',Value:user.email_confirmed_at?'true':'false'});
   let target;
   try{target=(await auth.send(new AdminCreateUserCommand({UserPoolId:pool,Username:user.id,MessageAction:'SUPPRESS',UserAttributes:attributes}))).User;}
   catch(error){if(error.name!=='UsernameExistsException')throw error;target=await auth.send(new AdminGetUserCommand({UserPoolId:pool,Username:user.id}));}
   const values=Object.fromEntries((target.Attributes??target.UserAttributes??[]).map(a=>[a.Name,a.Value]));
   if(values['custom:app_user_id']!==user.id||!values.sub||(user.email&&values.email!==user.email))throw Error('Identity mapping collision');
   // An unknown random password permits user-initiated recovery; no temporary
   // password or notification is sent during migration. Never replace a password
   // once this account has completed recovery.
   if(target.UserStatus==='FORCE_CHANGE_PASSWORD')await auth.send(new AdminSetUserPasswordCommand({UserPoolId:pool,Username:user.id,Password:'Aa1!'+randomBytes(48).toString('base64url'),Permanent:true}));
   for(const identity of source.auth_identities.filter(i=>i.user_id===user.id&&i.provider==='google')){
    const subject=identity.provider_id??identity.identity_data?.sub;if(!subject)continue;
    const linked=JSON.parse(values.identities??'[]');if(linked.some(i=>i.providerName==='Google'&&String(i.userId)===String(subject)))continue;
    await auth.send(new AdminLinkProviderForUserCommand({UserPoolId:pool,DestinationUser:{ProviderName:'Cognito',ProviderAttributeValue:user.id},SourceUser:{ProviderName:'Google',ProviderAttributeName:'Cognito_Subject',ProviderAttributeValue:String(subject)}}));
   }
   const disabled=!!user.banned_until&&new Date(user.banned_until).getTime()>Date.now();
   await put({PK:'IDENTITY#'+values.sub,SK:'PROFILE',userId:user.id,email:user.email,userMetadata:user.raw_user_meta_data??{},emailVerified:!!user.email_confirmed_at,disabled,source:'supabase',dataset},{ConditionExpression:'attribute_not_exists(PK) OR userId = :uid',ExpressionAttributeValues:{':uid':user.id}});mapped++;
  }
  await put({PK:'META#CURRENT',SK:'DATASET',dataset,state:'READY_READ_ONLY',exportedAt:source.exported_at,sha256:sha},{ConditionExpression:'attribute_not_exists(PK) OR #state = :readonly',ExpressionAttributeNames:{'#state':'state'},ExpressionAttributeValues:{':readonly':'READY_READ_ONLY'}});
  const result={...checkpoint,phase:'COMPLETE',sourceCounts:plan.counts,verifiedRecords:plan.items.length,verifiedObjects:media.objects.length,mappedUsers:mapped,archivedAnonymousUsers:anonymous,archivedUnmappedUsers:unmapped,exportedAt:source.exported_at,sha256:sha};
  await put(result);return {phase:result.phase,dataset,verifiedRecords:result.verifiedRecords,verifiedObjects:result.verifiedObjects,mappedUsers:mapped,archivedAnonymousUsers:anonymous};
 }catch(error){await put({...checkpoint,phase:'FAILED',error:error.name??'Error'});throw Error('Migration import failed; inspect sanitized checkpoint');}
}
