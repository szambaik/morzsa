export function wrappedMediaURL(apiUrl,bucket,path,presigned){return apiUrl+'/storage/v1/object/sign/'+bucket+'/'+path+'?token='+Buffer.from(presigned).toString('base64url');}
export function unwrapMediaURL(token,awsBucket,path){
 const url=new URL(Buffer.from(token??'','base64url').toString('utf8'));
 const allowed=[awsBucket+'.s3.eu-north-1.amazonaws.com',awsBucket+'.s3.amazonaws.com'];
 if(url.protocol!=='https:'||!allowed.includes(url.hostname)||url.username||url.password||decodeURIComponent(url.pathname)!=='/objects/'+path||!url.searchParams.has('X-Amz-Signature'))throw Error('Invalid media token');
 return url.href;
}
