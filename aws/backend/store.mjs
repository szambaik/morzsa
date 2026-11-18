import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,QueryCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {createHash,randomUUID} from 'node:crypto';
const cfg={region:process.env.AWS_REGION,maxAttempts:5};
const db=DynamoDBDocumentClient.from(new DynamoDBClient(cfg),{marshallOptions:{removeUndefinedValues:true}}),s3=new S3Client(cfg);
const TableName=process.env.DATA_TABLE,Bucket=process.env.MEDIA_BUCKET;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export class Transaction {
 constructor(dataset){this.dataset=dataset;this.states=new Map();this.dirty=new Set();this.pending=new Map();}
 key(scope){if(!/^[HUCRGM]#[a-z0-9-]+$/.test(scope))throw Error('Invalid entity scope');return {PK:'APP#'+this.dataset+'#'+scope,SK:'STATE'};}
 async get(scope){if(!this.pending.has(scope))this.pending.set(scope,this.load(scope));return this.pending.get(scope);}
 async load(scope){
  if(this.states.has(scope))return this.states.get(scope).value;
  const Key=this.key(scope),r=await db.send(new GetCommand({TableName,Key,ConsistentRead:true}));let value;
  if(r.Item?.objectKey){const object=await s3.send(new GetObjectCommand({Bucket,Key:r.Item.objectKey}));const bytes=await object.Body.transformToByteArray();if(hash(bytes)!==r.Item.sha256)throw Error('Entity checksum mismatch');value=JSON.parse(Buffer.from(bytes).toString('utf8'));}
  else if(r.Item?.record)value=JSON.parse(r.Item.record);
  else{
   const tables={};let cursor;
   do{const page=await db.send(new QueryCommand({TableName,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':Key.PK},ConsistentRead:true,ExclusiveStartKey:cursor}));for(const item of page.Items??[]){if(item.SK==='STATE')continue;const table=item.SK.split('#')[0];(tables[table]??=[]).push(JSON.parse(item.record));}cursor=page.LastEvaluatedKey;}while(cursor);
   value={tables};
  }
  this.states.set(scope,{value,revision:r.Item?.revision??0,Key});return value;
 }
 async edit(scope){const value=await this.get(scope);this.dirty.add(scope);return value;}
 async commit(){
  if(!this.dirty.size)return;
  if(this.states.size>100)throw Error('Transaction exceeds supported entity count');
  const TransactItems=[];
  for(const [scope,state] of this.states){
   const condition=state.revision?'revision = :previous':'attribute_not_exists(PK)';
   const shared={TableName,ConditionExpression:condition,...(state.revision?{ExpressionAttributeValues:{':previous':state.revision}}:{})};
   if(!this.dirty.has(scope)){TransactItems.push({ConditionCheck:{...shared,Key:state.Key}});continue;}
   const bytes=Buffer.from(JSON.stringify(state.value)),Item={...state.Key,revision:state.revision+1,updatedAt:new Date().toISOString()};
   // Small revision heads keep per-action DynamoDB capacity predictable. Larger
   // immutable state is committed through a checksummed S3 pointer atomically.
   if(bytes.length<=2048)Item.record=bytes.toString('utf8');
   else{Item.objectKey='entities/'+this.dataset+'/'+hash(Buffer.from(scope))+'/'+randomUUID()+'.json';Item.sha256=hash(bytes);await s3.send(new PutObjectCommand({Bucket,Key:Item.objectKey,Body:bytes,ContentType:'application/json',ChecksumSHA256:Buffer.from(Item.sha256,'hex').toString('base64')}));}
   TransactItems.push({Put:{...shared,Item}});
  }
  try{await db.send(new TransactWriteCommand({TransactItems,ClientRequestToken:randomUUID()}));}
  catch(error){if(error.name==='TransactionCanceledException'&&error.CancellationReasons?.some(r=>r.Code==='ConditionalCheckFailed'))throw Object.assign(Error('Conflict: refresh and retry'),{status:409,retryable:true});throw error;}
 }
}
export const rows=(state,name)=>state.tables[name]??=[];
export const replace=(state,name,list)=>{state.tables[name]=list;};
