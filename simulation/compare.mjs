import fs from 'node:fs/promises';
const [before,after]=process.argv.slice(2);if(!before||!after)throw Error('Usage: node simulation/compare.mjs <before-run> <after-run>');
const read=dir=>fs.readFile(dir+'/metrics.json','utf8').then(JSON.parse),[a,b]=await Promise.all([read(before),read(after)]);
if(a.seed!==b.seed||a.mode!==b.mode||a.events!==b.events)throw Error('Comparison requires matching seed, mode and event count');
console.log(JSON.stringify({before:a.runId,after:b.runId,passedInvariantDelta:b.invariants.passed-a.invariants.passed,newFailures:b.failures.filter(x=>!a.failures.some(y=>y.event===x.event&&y.name===x.name)),resolvedFailures:a.failures.filter(x=>!b.failures.some(y=>y.event===x.event&&y.name===x.name)),note:'Compare UI session evidence separately; invariant scores are not UX scores.'},null,2));
