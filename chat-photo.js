// Re-encode selected photos before upload: bounded size, no EXIF metadata.
const ChatPhoto={async prepare(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('PHOTO_FORMAT');
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;await img.decode();
  if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw Error('PHOTO_FORMAT');
  const encode=(size,quality)=>{const c=document.createElement('canvas'),ratio=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*ratio));c.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',quality)};
  const full=encode(1280,.8);let thumb=encode(180,.65);if(thumb.length>16000)thumb=encode(120,.5);
  if(full.length>2000000||thumb.length>16000)throw Error('PHOTO_FORMAT');
  return {image:{mimeType:'image/jpeg',data:full.split(',')[1]},photo:thumb};
 }finally{URL.revokeObjectURL(url)}
}};
