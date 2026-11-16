"""Isolated browser action mailbox. Actors receive visible UI only."""
import json, sys, time, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parent / 'runs/ui-agent-2026-11-14/broker'
ROOT.mkdir(parents=True, exist_ok=True)
def main():
 mode = sys.argv[1]
 if mode == 'next':
  for p in sorted(ROOT.glob('*.request.json')):
   claimed = p.with_suffix('.claimed')
   p.rename(claimed)
   print(claimed.read_text()); return
  print('null'); return
 if mode == 'reply':
  data=json.loads(sys.argv[2]); rid=data.pop('id')
  target=ROOT/(rid+'.response.json'); temp=target.with_suffix('.tmp')
  temp.write_text(json.dumps(data,ensure_ascii=False));temp.rename(target);return
 actor, operation = sys.argv[1:3]
 if actor not in [f'{f}-{m}' for f in 'ABCDEF' for m in 'ab']: raise ValueError('Actor invalid')
 if operation not in ['observe','click','fill','select','press','scroll','reload','screenshot','finish']: raise ValueError('Operation invalid')
 rid=uuid.uuid4().hex
 request={'id':rid,'actor':actor,'operation':operation,'ref':sys.argv[3] if len(sys.argv)>3 else '', 'value':sys.argv[4] if len(sys.argv)>4 else ''}
 p=ROOT/(rid+'.request.json');tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(request,ensure_ascii=False));tmp.rename(p)
 response=ROOT/(rid+'.response.json')
 until=time.monotonic()+55
 while not response.exists():
  if time.monotonic()>until: print(json.dumps({'infrastructureError':'broker response timed out','requestId':rid}));return
  time.sleep(.2)
 print(response.read_text())
if __name__=='__main__': main()
