// Small safe Markdown subset. Text and ingredient labels are always escaped by inline().
const ChatFormat=(()=>{
 function render(text,inline){
  const emphasis=s=>s.split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g).map(t=>t.startsWith('**')&&t.endsWith('**')||t.startsWith('__')&&t.endsWith('__')?'<strong>'+inline(t.slice(2,-2))+'</strong>':t.startsWith('*')&&t.endsWith('*')?'<em>'+inline(t.slice(1,-1))+'</em>':inline(t)).join('');
  let out='',paragraph=[],list=[],type='';
  const flush=()=>{if(paragraph.length){out+='<p>'+paragraph.map(emphasis).join('<br>')+'</p>';paragraph=[]}if(list.length){out+='<'+type+'>'+list.map(s=>'<li>'+emphasis(s)+'</li>').join('')+'</'+type+'>';list=[];type=''}};
  for(const line of String(text).replace(/\r\n?/g,'\n').split('\n')){
   if(!line.trim()){flush();continue}
   const heading=/^#{1,6}\s+(.+)$/.exec(line),bullet=/^\s*[-*+]\s+(.+)$/.exec(line),number=/^\s*\d+[.)]\s+(.+)$/.exec(line);
   if(heading){flush();out+='<h4>'+emphasis(heading[1])+'</h4>';continue}
   if(bullet||number){const next=bullet?'ul':'ol';if(paragraph.length||type&&type!==next)flush();type=next;list.push((bullet||number)[1]);continue}
   if(list.length)flush();paragraph.push(line);
  }
  flush();return out;
 }
 return {render};
})();
if(typeof module!=='undefined')module.exports=ChatFormat;
