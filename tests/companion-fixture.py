"""Isolated manual QA: fake AI, local test storage, no Supabase writes. Port 8777."""
import sys, re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Handler, ThreadingHTTPServer
seed='''<script>
if(!localStorage.getItem('companion-fixture-seeded')){
localStorage.setItem('morzsa-v2',JSON.stringify({stock:{Tej:2,Tojás:2,Liszt:2,Alma:2,Olaj:2,Kenyér:2,Joghurt:2,Paprika:2},custom:[],cart:[{name:'Alma',quantity:1,unit:'kg',done:false}],likes:[],history:[],chats:{}}));localStorage.setItem('companion-fixture-seeded','1');}
if(location.search.includes('days')&&!localStorage.getItem('chat-days-fixture-seeded')){
 const now=Date.now(),yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
 localStorage.setItem('morzsa-companion-v2:'+JSON.stringify(['companion-fixture','local','hu']),JSON.stringify({version:2,active:'morzsa-main',threads:[{id:'morzsa-main',kind:'main',updated:now,messages:[{role:'user',text:'Egy régi, dátum nélküli üzenet.'},{role:'user',text:'Tegnap paradicsomlevest főztünk.',createdAt:yesterday.getTime()},{role:'model',text:'Legközelebb bazsalikommal is kipróbálhatod.',createdAt:yesterday.getTime()},{role:'user',text:'Ma valami gyors vacsorát szeretnék.',createdAt:now},{role:'model',text:'Nézzünk körül a készletben!',createdAt:now}]}]}));localStorage.setItem('chat-days-fixture-seeded','1');
}
if(location.search.includes('cooking')&&!localStorage.getItem('cooking-guide-fixture-seeded')){
 const now=Date.now(),r={title:'Almás palacsinta',summary:'Egy gyors, otthonos édesség két főre.',minutes:20,ingredients:[{name:'Tojás',amount:'2 db'},{name:'Liszt',amount:'120 g'},{name:'Tej',amount:'150 ml'},{name:'Alma',amount:'1 db'},{name:'Olaj',amount:'1 ek'}],steps:['Keverd simára a tojást, tejet és lisztet.','Reszeld bele az almát, és keverd át.','Süsd kis adagokban, közepes lángon, mindkét oldalát aranyszínűre.']};
 localStorage.setItem('morzsa-companion-v2:'+JSON.stringify(['companion-fixture','local','hu']),JSON.stringify({version:2,active:'morzsa-main',threads:[{id:'morzsa-main',kind:'main',updated:now,messages:[{role:'model',text:'Készítsünk almás palacsintát!',createdAt:now,recipes:[r]}]},{id:'cooking-fixture',kind:'recipe',title:r.title,recipe:r,status:'active',updated:now,messages:Array.from({length:12},(_,i)=>({role:i%2?'model':'user',text:i%2?'Ezt a receptet együtt alakítjuk.':'Főzési kérdés '+(i+1),createdAt:now+i}))}]}));localStorage.setItem('cooking-guide-fixture-seeded','1');
}
</script>'''
mock='''<script>
window.household={active:null,busy:false,userId:()=> 'companion-fixture',storageKey:()=> 'morzsa-v2',notify:()=>Promise.resolve(true),voiceStatus:()=>Promise.resolve({configured:true,supportsImages:true,supportsStreaming:true}),voiceCommand:async payload=>{
await new Promise(r=>setTimeout(r,300));const text=payload.text||'Elfogyott a tej. Írd a listára.';
return {transcript:text,answer:text.includes('tej')?'A tejet kivehetjük a készletből és felírhatjuk a listára.':'## Ma legyen almás palacsinta\\n\\nGyors, otthonos édesség a készletedből.\\n\\n**Ezt nézd meg előtte:**\\n- Tojás, tej és liszt: van még elég?\\n- Az almát reszeld a tésztába.\\n\\nA pontos mennyiségeket lent, a receptnél találod.',clarification:'',operations:text.includes('tej')?[{action:'stock_remove',name:'Tej',quantity:null,unit:null},{action:'list_set',name:'Tej',quantity:null,unit:null}]:[],recipes:text.includes('tej')?[]:[{title:'Almás palacsinta',summary:'Egy gyors, otthonos édesség.',minutes:20,ingredients:[{name:'Tojás',amount:'2 db'},{name:'Liszt',amount:'120 g'},{name:'Tej',amount:'150 ml'},{name:'Alma',amount:'1 db'},{name:'Olaj',amount:'1 ek'}],steps:['Keverd simára a tésztát.','Reszeld bele az almát.','Süsd kis adagokban mindkét oldalát aranyszínűre.']}]};},updateLanguage:()=>{}};
window.household.voiceCommandStream=async (p,onAnswer,signal)=>{const r=await window.household.voiceCommand(p);for(let i=8;i<r.answer.length+8;i+=8){if(signal?.aborted)throw new DOMException('Stopped','AbortError');onAnswer(r.answer.slice(0,i));await new Promise(resolve=>setTimeout(resolve,90))}return r};
window.household.recipeIdeas=async p=>{const r=await window.household.voiceCommand({text:p.text});return {answer:r.answer,recipes:r.recipes}};
document.getElementById('household-button').textContent='Tesztkonyha';
</script>'''
class Fixture(Handler):
 def do_GET(self):
  if self.path.split('?')[0]=='/':
   html=Path('index.html').read_text().replace('<script src="app.js',seed+'<script src="app.js')
   html=re.sub(r'<script src="household.js[^>]*></script>',lambda _:mock,html)
   body=html.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  else:super().do_GET()
port=int(sys.argv[1]) if len(sys.argv)>1 else 8777
server=ThreadingHTTPServer(('127.0.0.1',port),Fixture)
print(f'Companion QA: http://127.0.0.1:{port}/',flush=True)
server.serve_forever()
