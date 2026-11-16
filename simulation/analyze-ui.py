"""Count actual actor evidence; never derive AI or realtime accuracy from fixtures."""
import json, sys, collections
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'simulation/runs/ui-agent-2026-11-14')
actors=[]
for p in sorted(root.glob('*/events.jsonl')):
 events=[json.loads(line) for line in p.read_text().splitlines() if line.strip()]
 steps=[e for e in events if e.get('operation') not in ('initial','finish')]
 ends=[e for e in events if e.get('operation')=='finish']
 if not steps and not ends: continue
 errors=collections.Counter()
 for e in steps:
  if not e.get('error'): continue
  if not e.get('ref'): category='agent_malformed_reference'
  elif 'strict mode violation' in e['error'] and 'data-sim-ref' in e['error']: category='harness_duplicate_reference'
  else: category='unclassified_browser_error'
  errors[category]+=1
 outcome=None
 if ends:
  try: outcome=json.loads(ends[-1]['outcome'])
  except (KeyError,ValueError): outcome={'unparsed':ends[-1].get('outcome')}
 actors.append({'actor':p.parent.name,'calls':len(steps),'actions':sum(e.get('operation') not in ('observe','screenshot') for e in steps),'errors':dict(errors),'finished':bool(ends),'outcome':outcome})
metrics={'runId':root.name,'mode':'bounded real-frontend UI pilot with fixture AI and shared transport','completedActorSessions':len(actors),'householdsWithActorSessions':len({a['actor'][0] for a in actors}),'calls':sum(a['calls'] for a in actors),'actions':sum(a['actions'] for a in actors),'browserErrors':sum(sum(a['errors'].values()) for a in actors),'aiIntentAccuracy':None,'productionRealtimeAccuracy':None,'taskCompletionRate':None,'externalProviderCalls':0,'externalProviderCostUsd':0,'codexTokens':None,'codexCostUsd':None,'actors':actors}
(root/'metrics.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in metrics.items() if k!='actors'},ensure_ascii=False,indent=2))
