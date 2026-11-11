"""Isolated manual QA: fake AI, local test storage, no Supabase writes. Port 8777."""
import sys, re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Handler, ThreadingHTTPServer
seed='''<script>
if(!localStorage.getItem('companion-fixture-seeded')){
localStorage.setItem('morzsa-v2',JSON.stringify({stock:{Tej:2,Tojás:2,Liszt:2,Alma:2,Olaj:2},custom:[],cart:[{name:'Alma',quantity:1,unit:'kg',done:false}],likes:[],history:[],chats:{}}));localStorage.setItem('companion-fixture-seeded','1');}
</script>'''
mock='''<script>
window.household={active:null,busy:false,userId:()=> 'companion-fixture',storageKey:()=> 'morzsa-v2',notify:()=>Promise.resolve(true),voiceStatus:()=>Promise.resolve({configured:true}),voiceCommand:async payload=>{
await new Promise(r=>setTimeout(r,300));const text=payload.text||'Elfogyott a tej. Írd a listára.';
return {transcript:text,answer:text.includes('tej')?'A tejet kivehetjük a készletből és felírhatjuk a listára.':'Készíthetünk almás palacsintát. A készlet csak támpont: ellenőrizd, hogy mindenből van-e elég.',clarification:'',operations:text.includes('tej')?[{action:'stock_remove',name:'Tej',quantity:null,unit:null},{action:'list_set',name:'Tej',quantity:null,unit:null}]:[],recipes:text.includes('tej')?[]:[{title:'Almás palacsinta',summary:'Egy gyors, otthonos édesség.',minutes:20,ingredients:[{name:'Tojás',amount:'2 db'},{name:'Liszt',amount:'120 g'},{name:'Tej',amount:'150 ml'},{name:'Alma',amount:'1 db'},{name:'Olaj',amount:'1 ek'}],steps:['Keverd simára a tésztát.','Reszeld bele az almát.','Süsd kis adagokban mindkét oldalát aranyszínűre.']}]};},updateLanguage:()=>{}};
window.household.recipeIdeas=async p=>{const r=await window.household.voiceCommand({text:p.text});return {answer:r.answer,recipes:r.recipes}};
document.getElementById('household-button').textContent='Tesztkonyha';
</script>'''
class Fixture(Handler):
 def do_GET(self):
  if self.path.split('?')[0]=='/':
   html=Path('index.html').read_text().replace('<script src="app.js',seed+'<script src="app.js')
   html=re.sub(r'<script src="household.js[^>]*></script>',mock,html)
   body=html.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',8777),Fixture)
print('Companion QA: http://127.0.0.1:8777/',flush=True)
server.serve_forever()
