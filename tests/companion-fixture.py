"""Isolated manual QA: fake AI, local test storage, no Supabase writes. Port 8777."""
import sys, re, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Handler, ThreadingHTTPServer
seed='''<script>
if(location.search.includes('intro')){localStorage.removeItem('morzsa-introduction-v1');localStorage.removeItem('morzsa-v1');localStorage.removeItem('morzsa-v2');}

if(location.search.includes('pantrytarget')&&!localStorage.getItem('pantry-target-seeded')){localStorage.setItem('morzsa-v2',JSON.stringify({stock:{Tej:2,Tojás:2,Kenyér:2,Alma:2,Liszt:2},custom:[],cart:[{name:'Alma',quantity:1,done:false}],likes:[],history:[],chats:{}}));localStorage.setItem('companion-fixture-seeded','1');localStorage.setItem('pantry-target-seeded','1');localStorage.setItem('morzsa-pantry-review-local',JSON.stringify(Object.fromEntries(['Tej','Tojás','Kenyér','Alma','Liszt'].map(n=>[n,new Date().toISOString()]))));}

if(!localStorage.getItem('companion-fixture-seeded')){
localStorage.setItem('morzsa-v2',JSON.stringify({stock:{Tej:2,Tojás:2,Liszt:2,Alma:2,Olaj:2,Kenyér:2,Joghurt:2,Paprika:2},custom:[],cart:[{name:'Alma',quantity:1,unit:'kg',done:false}],likes:[],history:[],chats:{}}));localStorage.setItem('companion-fixture-seeded','1');}
if(location.search.includes('days')&&!localStorage.getItem('chat-days-fixture-seeded')){
 const now=Date.now(),yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
 localStorage.setItem('morzsa-companion-v2:'+JSON.stringify(['companion-fixture','local','hu']),JSON.stringify({version:2,active:'morzsa-main',threads:[{id:'morzsa-main',kind:'main',updated:now,messages:[{role:'user',text:'Egy régi, dátum nélküli üzenet.'},{role:'user',text:'Tegnap paradicsomlevest főztünk.',createdAt:yesterday.getTime()},{role:'model',text:'Legközelebb bazsalikommal is kipróbálhatod.',createdAt:yesterday.getTime()},{role:'user',text:'Ma valami gyors vacsorát szeretnék.',createdAt:now},{role:'model',text:'Nézzünk körül a készletben!',createdAt:now}]}]}));localStorage.setItem('chat-days-fixture-seeded','1');
}
if(location.search.includes('cooking')&&!localStorage.getItem('cooking-guide-fixture-seeded')){
 const now=Date.now(),r={title:'Almás palacsinta',summary:'Egy gyors, otthonos édesség két főre.',minutes:20,ingredients:[{name:'Tojás',amount:'2 db'},{name:'Liszt',amount:'120 g'},{name:'Tej',amount:'150 ml'},{name:'Alma',amount:'1 db'},{name:'Olaj',amount:'1 ek'}],steps:['Keverd simára a tojást, tejet és lisztet.','Reszeld bele az almát, és keverd át.','Süsd kis adagokban, közepes lángon, mindkét oldalát aranyszínűre.']};
 if(location.search.includes('named')){r.stepTitles=['A palacsintatészta összeállítása','Az alma előkészítése','Az almás palacsinták sütése'];r.steps=['Üsd a tojásokat egy tálba, majd öntsd hozzá a tejet. Keverd bele a lisztet apránként, hogy ne legyen csomós. Sűrű, de még kanállal adagolható tésztát kapj.','Mosd meg az almát, távolítsd el a magházát, majd reszeld le. Forgasd a tésztába, hogy egyenletesen eloszoljon.','Melegíts kevés olajat egy serpenyőben közepes lángon. Kanalazz bele kisebb adagokat, és süsd körülbelül 2–3 percig oldalanként. Akkor fordítsd meg, amikor a széle szilárdul; a közepe is süljön át.'];}
 localStorage.setItem('morzsa-companion-v2:'+JSON.stringify(['companion-fixture','local','hu']),JSON.stringify({version:2,active:'morzsa-main',threads:[{id:'morzsa-main',kind:'main',updated:now,messages:[{role:'model',text:'Készítsünk almás palacsintát!',createdAt:now,recipes:[r]}]},{id:'cooking-fixture',kind:'recipe',title:r.title,recipe:r,status:'active',updated:now,messages:Array.from({length:12},(_,i)=>({role:i%2?'model':'user',text:i%2?'Ezt a receptet együtt alakítjuk.':'Főzési kérdés '+(i+1),createdAt:now+i}))}]}));localStorage.setItem('cooking-guide-fixture-seeded','1');
}
if(location.search.includes('history')&&!localStorage.getItem('history-rail-fixture-seeded')){
 const now=Date.now(),r={title:'Almás palacsinta',summary:'Egy gyors, otthonos édesség két főre.',minutes:20,ingredients:[{name:'Tej',amount:'150 ml'},{name:'Liszt',amount:'120 g'}],steps:['Keverd össze a tésztát.','Süsd aranyszínűre.']};
 const titles=['Mit vigyek az irodába?','Gyors vacsora péntekre','Mit főzzünk hétvégén?','Sütés a gyerekekkel','Bevásárlás a hétre','Nincs itthon tojás','Szezonális ötletek'];
 const threads=[{id:'morzsa-main',kind:'main',title:'A konyhánk',updated:now-8000,messages:[]},...titles.map((title,i)=>({id:'chat-'+i,kind:'chat',title,updated:now-i*1000,messages:[{role:'user',text:title,createdAt:now},{role:'model',text:'Nézzünk egy könnyen dobozolható, másnap is finom sütit. Egy almás muffin jó választás lehet.',createdAt:now}]})),{id:'cook-active',kind:'recipe',title:r.title,recipe:r,status:'active',updated:now,parentId:'chat-0',messages:[]},{id:'cook-completed',kind:'recipe',title:'Korábbi palacsintasütés',recipe:r,status:'completed',updated:now-10000,messages:[]}];
 localStorage.setItem('morzsa-companion-v4:'+JSON.stringify(['companion-fixture','local','hu']),JSON.stringify({version:4,active:'chat-0',threads}));localStorage.setItem('history-rail-fixture-seeded','1');
}
</script>'''
mock='''<script>
window.household={active:null,busy:false,userId:()=> 'companion-fixture',storageKey:()=> 'morzsa-v2',notify:()=>Promise.resolve(true),voiceStatus:()=>Promise.resolve({configured:true,supportsImages:true,supportsStreaming:true}),voiceCommand:async payload=>{
await new Promise(r=>setTimeout(r,300));const text=payload.text||'Elfogyott a tej. Írd a listára.';
return {transcript:text,answer:text.includes('tej')?'A tejet kivehetjük a készletből és felírhatjuk a listára.':'## Ma legyen almás palacsinta\\n\\nGyors, otthonos édesség a készletedből.\\n\\n**Ezt nézd meg előtte:**\\n- Tojás, tej és liszt: van még elég?\\n- Az almát reszeld a tésztába.\\n\\nA pontos mennyiségeket lent, a receptnél találod.',clarification:'',operations:text.includes('tej')?[{action:'stock_remove',name:'Tej',quantity:null,unit:null},{action:'list_set',name:'Tej',quantity:null,unit:null}]:[],recipes:text.includes('tej')?[]:[{title:'Almás palacsinta',summary:'Egy gyors, otthonos édesség.',minutes:20,ingredients:[{name:'Tojás',amount:'2 db'},{name:'Liszt',amount:'120 g'},{name:'Tej',amount:'150 ml'},{name:'Alma',amount:'1 db'},{name:'Olaj',amount:'1 ek'}],steps:['Keverd simára a tésztát.','Reszeld bele az almát.','Süsd kis adagokban mindkét oldalát aranyszínűre.']}]};},updateLanguage:()=>{}};
window.MORZSA_CLOUD={url:location.origin};
window.household.recipeImage=async ()=>{await new Promise(resolve=>setTimeout(resolve,300));if(location.search.includes('imagefail'))throw Error('IMAGE_UNAVAILABLE');return {status:'ready',url:location.origin+'/storage/v1/object/sign/fixture-pancake.jpg',expiresAt:Date.now()+3600000}};
window.household.voiceCommandStream=async (p,onAnswer,signal)=>{const r=await window.household.voiceCommand(p);if(location.search.includes('burst')){onAnswer(r.answer);return r;}for(let i=8;i<r.answer.length+8;i+=8){if(signal?.aborted)throw new DOMException('Stopped','AbortError');onAnswer(r.answer.slice(0,i));await new Promise(resolve=>setTimeout(resolve,90))}return r};
window.household.recipeIdeas=async p=>{const r=await window.household.voiceCommand({text:p.text});return {answer:r.answer,recipes:r.recipes}};
document.getElementById('household-button').textContent='Tesztkonyha';
if(location.search.includes('savefail'))commitState=()=>false;
</script>'''
class Fixture(Handler):
 def do_GET(self):
  if self.path.startswith('/rest/v1/households?'):
   homes=[{'id':'qa-home','name':'Otthon','owner_id':'qa-member'}];body=json.dumps(homes).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)
  elif self.path.startswith('/rest/v1/'):
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'[]')
  elif self.path.split('?')[0]=='/design-comparison':
   body=('<!doctype html><html><head><title>Selected concept / production</title></head><body style="margin:0;background:#ddd;display:flex;gap:20px"><iframe title="Selected Kitchen Companion" src="http://127.0.0.1:8793/companion.html" style="width:390px;height:676px;border:0"></iframe><iframe title="Production Kitchen Companion" src="/" style="width:390px;height:676px;border:0"></iframe></body></html>').encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  elif self.path.split('?')[0]=='/mobile-preview':
   width=320 if '320' in self.path else 390
   height=676 if 'compact' in self.path else 844
   body=('<!doctype html><html><head><title>Mobile QA</title></head><body style="margin:0;background:#ddd"><iframe title="Morzsa mobile QA" src="/?history&amp;pantrytarget'+('&amp;'+self.path.split('?',1)[1].replace('&','&amp;') if '?' in self.path else '')+'" style="display:block;width:'+str(width)+'px;height:'+str(height)+'px;border:0"></iframe></body></html>').encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  elif self.path.split('?')[0]=='/':
   html=Path('index.html').read_text().replace('<script src="app.js',seed+'<script src="app.js')
   if 'intro' in self.path:html=html.replace('<script src="onboarding.js', '<script>localStorage.removeItem("morzsa-v1");localStorage.removeItem("morzsa-v2");localStorage.removeItem("morzsa-introduction-v1");</script><script src="onboarding.js')
   if 'kitchens' in self.path:
    html=re.sub(r'<script src="household-config.js[^>]*></script>',lambda _:'<script>window.MORZSA_CLOUD={url:location.origin,publishableKey:"qa"};localStorage.setItem("morzsa-session",JSON.stringify({access_token:"qa-token",expires_at:9999999999,user:{id:"qa-member",email:"test@example.com"}}));localStorage.setItem("morzsa-last-household-qa-member",JSON.stringify({id:null}));</script>',html)
   else:html=re.sub(r'<script src="household.js[^>]*></script>',lambda _:mock,html)
   if 'recipes' in self.path:html=html.replace('</body>','<script>page="recipes";render();</script></body>')
   body=html.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  elif self.path.split('?')[0]=='/storage/v1/object/sign/fixture-pancake.jpg':
   body=Path('assets/food/pancake.jpg').read_bytes();self.send_response(200);self.send_header('Content-Type','image/jpeg');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  else:super().do_GET()
 def do_POST(self):
  if self.path.startswith('/rest/v1/rpc/'):
   self.rfile.read(int(self.headers.get('Content-Length','0')));self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'[]')
  else:super().do_POST()
port=int(sys.argv[1]) if len(sys.argv)>1 else 8777
server=ThreadingHTTPServer(('127.0.0.1',port),Fixture)
print(f'Companion QA: http://127.0.0.1:{port}/',flush=True)
server.serve_forever()
