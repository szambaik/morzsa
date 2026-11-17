export async function thumbnail(bytes:Uint8Array){
 const {Image}=await import('https://deno.land/x/imagescript@1.3.0/mod.ts');
 const image=await Image.decode(bytes);image.resize(320,Image.RESIZE_AUTO);return image.encodeJPEG(75);
}
