import {randomUUID} from 'node:crypto';
export function withTelemetry(handler,service){return async(event,context={})=>{
 const started=performance.now(),requestId=context.awsRequestId??event.requestContext?.requestId??randomUUID();
 const path=(event.rawPath??'/internal').replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,':id');
 let status=500;try{const response=await handler(event,context);status=response.statusCode??200;response.headers={...response.headers,'X-Morzsa-Request-Id':requestId,'Access-Control-Expose-Headers':'X-Morzsa-Request-Id,Server-Timing','Server-Timing':'app;dur='+Math.round(performance.now()-started)};return response;}
 finally{console.info(JSON.stringify({event:'morzsa_request',service,requestId,method:event.requestContext?.http?.method,path,status,durationMs:Math.round((performance.now()-started)*100)/100}));}
};}
