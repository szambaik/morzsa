"""Actual frontend and isolated agent evidence; no production writes/providers."""
import sys, json, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fixture import Pilot, base

RUN = Path('simulation/runs/ui-agent-2026-11-14')
class AgentPilot(Pilot):
 def do_POST(self):
  if self.path == '/sim-log':
   size = int(self.headers.get('Content-Length', '0'))
   if size > 250000:
    self.send_error(413); return
   event = json.loads(self.rfile.read(size))
   actor = event.get('actor', '')
   if not re.fullmatch(r'[A-F]-[ab]', actor):
    self.send_error(400); return
   folder = RUN / actor; folder.mkdir(parents=True, exist_ok=True)
   with (folder / 'events.jsonl').open('a') as stream:
    stream.write(json.dumps(event, ensure_ascii=False) + '\n')
   self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b'{"saved":true}')
  else: super().do_POST()

if __name__ == '__main__':
 RUN.mkdir(parents=True, exist_ok=True)
 port = int(sys.argv[1]) if len(sys.argv)>1 else 8821
 print(f'Isolated agent UI: http://127.0.0.1:{port}/', flush=True)
 base.ThreadingHTTPServer(('127.0.0.1', port), AgentPilot).serve_forever()
