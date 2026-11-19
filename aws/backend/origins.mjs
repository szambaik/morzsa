// Explicit deployment configuration; never accept an arbitrary CloudFront tenant.
export const allowedOrigins=['https://szambaik.github.io','capacitor://localhost','https://localhost','http://localhost','http://localhost:8080'];
if(process.env.FRONTEND_ORIGIN){
 const origin=new URL(process.env.FRONTEND_ORIGIN);
 if(origin.protocol!=='https:'||origin.origin!==process.env.FRONTEND_ORIGIN)throw Error('Invalid frontend origin');
 allowedOrigins.push(origin.origin);
}
export const webCallbacks=['https://szambaik.github.io/morzsa/','http://localhost:8080/',...(process.env.FRONTEND_ORIGIN?[process.env.FRONTEND_ORIGIN+'/']:[])];
