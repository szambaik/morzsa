// Portable recipes contain only the recipe and an optional already-created cover.
const RecipeExport = (() => {
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function validated(value){const r=RecipeRoomModel.recipe(value);if(!r)throw Error('Invalid recipe');return r}
 function filename(value){return 'morzsa-'+validated(value).title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64).replace(/-$/,'')+'.html'}
 function text(value,lang='hu'){const r=validated(value),en=lang==='en';return [r.title,r.minutes+(en?' minutes':' perc'),r.summary,'',en?'INGREDIENTS':'HOZZÁVALÓK',...r.ingredients.map(i=>i.amount+' · '+i.name),'',en?'METHOD':'ELKÉSZÍTÉS',...r.steps.map((s,i)=>(i+1)+'. '+RecipeRoomModel.stepTitle(r,i)+'\n'+s),'',en?'Shared from Morzsa':'Morzsából megosztott recept'].join('\n')}
 function html(value,lang='hu',cover=''){
  const r=validated(value),en=lang==='en',image=typeof cover==='string'&&cover.length<4000000&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(cover)?cover:'';
  return '<!doctype html><html lang="'+(en?'en':'hu')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data:; style-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;"><title>'+escape(r.title)+' · Morzsa</title><style>body{margin:0;background:#f8f3e9;color:#203f32;font:18px/1.6 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:32px 24px}h1{font-size:clamp(32px,6vw,48px);line-height:1.15}h2{margin-top:36px}h3{line-height:1.35}small{color:#746859}img{width:100%;max-height:440px;object-fit:cover;border-radius:24px}ul,ol{padding-left:24px}li{padding:8px 0}ol li{break-inside:avoid}footer{margin-top:40px;color:#746859}@media print{body{background:white;font-size:12pt}main{padding:0}img{max-height:230px}h2{break-after:avoid}footer{font-size:10pt}}</style><main><small>MORZSA · '+(en?'Your kitchen companion':'A konyhai társad')+'</small>'+(image?'<p><img src="'+image+'" alt="'+escape(r.title)+'"><small>'+(en?'AI illustration':'AI-illusztráció')+'</small></p>':'')+'<h1>'+escape(r.title)+'</h1><p>'+r.minutes+(en?' minutes':' perc')+'</p><p>'+escape(r.summary)+'</p><h2>'+(en?'Ingredients':'Hozzávalók')+'</h2><ul>'+r.ingredients.map(i=>'<li><strong>'+escape(i.amount)+'</strong> · '+escape(i.name)+'</li>').join('')+'</ul><h2>'+(en?'Method':'Elkészítés')+'</h2><ol>'+r.steps.map((s,i)=>'<li><h3>'+escape(RecipeRoomModel.stepTitle(r,i))+'</h3><p>'+escape(s)+'</p></li>').join('')+'</ol><footer>'+(en?'Shared from Morzsa. You can print this recipe or save it as PDF using your browser.':'Morzsából megosztott recept. A böngésző Nyomtatás menüjével PDF-ként is elmentheted.')+'</footer></main></html>';
 }
 async function share(value,lang='hu'){
  const r=validated(value),payload={title:r.title,text:text(r,lang)};
  if(window.MorzsaNative?.shareText){await window.MorzsaNative.shareText(payload);return 'shared'}
  if(navigator.share){try{await navigator.share(payload);return 'shared'}catch(e){if(e.name==='AbortError')return 'cancelled';if(!['NotSupportedError','TypeError'].includes(e.name))throw e}}
  if(window.MorzsaNative?.copyText)await window.MorzsaNative.copyText(payload.text);else await navigator.clipboard.writeText(payload.text);return 'copied';
 }
 async function download(value,lang='hu'){
  const r=validated(value),cover=await window.RecipeImages?.cachedCover(r).catch(()=>''),content=html(r,lang,cover),name=filename(r);
  if(window.MorzsaNative?.exportRecipe){await window.MorzsaNative.exportRecipe({name,content,title:r.title});return 'shared'}
  const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return 'downloaded';
 }
 return {text,html,filename,share,download};
})();
if(typeof module!=='undefined')module.exports=RecipeExport;
