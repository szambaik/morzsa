"""Actual frontend, synthetic local data and canned AI; no production writes."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tests'))
from importlib import import_module
base = import_module('companion-fixture')
class Pilot(base.Fixture):
 def do_GET(self):
  if self.path.startswith('/simulation-preview'):
   query = '?intro' if 'intro' in self.path else ''
   body = ('<!doctype html><meta charset="utf-8"><title>Morzsa UX pilot</title>'
    '<body style="margin:0;background:#e9e4dc"><iframe title="Morzsa mobile" src="/'+query+'" '
    'style="display:block;width:390px;height:844px;border:0"></iframe>').encode()
   self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8')
   self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
  else: super().do_GET()
if __name__ == '__main__':
 port=int(sys.argv[1]); print(f'Isolated UI pilot: http://127.0.0.1:{port}/simulation-preview',flush=True)
 base.ThreadingHTTPServer(('127.0.0.1',port),Pilot).serve_forever()
