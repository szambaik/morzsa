import {spawn} from 'node:child_process';
export async function uploadLocal(url,file){
 return new Promise((resolve,reject)=>{
  const child=spawn('curl',['--config','-']);let output='';
  child.stdout.on('data',c=>output+=c);child.stderr.resume();
  child.on('error',reject);
  child.on('close',code=>code===0&&output.trim()==='200'?resolve({key:file.key,status:200}):reject(Error('S3 upload failed: '+code+' '+output.slice(0,80))));
  const lines=['silent','show-error','request = "PUT"','url = '+JSON.stringify(url),'upload-file = '+JSON.stringify(file.path),'header = '+JSON.stringify('Content-Type: '+file.type),'header = '+JSON.stringify('x-amz-checksum-sha256: '+file.checksum),'output = "/dev/null"','write-out = "%{http_code}"'];
  child.stdin.end(lines.join('\n')+'\n');
 });
}
