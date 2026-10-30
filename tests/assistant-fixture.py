"""Local, isolated manual UI fixture. Does not call Google or Supabase.
Run from repository root: python3 tests/assistant-fixture.py; open :8774.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Handler, ThreadingHTTPServer
fixture = """<script>
localStorage.setItem('morzsa-v2',JSON.stringify({stock:{Vaj:2,Tojás:2},custom:[],cart:[],likes:[],history:[],chats:{}}));
</script>"""
mock = """<script>
window.household={active:null,busy:false,userId:()=> 'fixture',storageKey:()=> 'morzsa-v2',notify:()=>Promise.resolve(true),voiceStatus:()=>Promise.resolve({configured:true}),voiceCommand:payload=>Promise.resolve({transcript:payload.text||'Vettem tejet, elfogyott a vaj.',clarification:'',operations:[{action:'stock_add',name:'Tej',quantity:null,unit:null},{action:'stock_remove',name:'Vaj',quantity:null,unit:null}]}),updateLanguage:()=>{}};
document.getElementById('household-button').textContent='Helyi teszt';
</script>"""
class Fixture(Handler):
 def do_GET(self):
  if self.path.split('?')[0]=='/':
   import re
   html=Path('index.html').read_text().replace('<script src="app.js',fixture+'<script src="app.js')
   html=re.sub(r'<script src="household.js[^>]*></script>',mock,html)
   body=html.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  else:super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',8774),Fixture)
print('Isolated assistant fixture: http://localhost:8774/',flush=True)
server.serve_forever()
