"""Validate saved audit evidence without running the application or contacting services."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import struct
import urllib.parse
import zipfile
import zlib

B = Path(__file__).resolve().parent
meta = json.loads((B / 'snapshot.json').read_text())
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
errors = []
counts = {'json': 0, 'png': 0, 'traceZip': 0, 'cpuProfile': 0, 'networkRequests': 0}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

snapshot = Path(meta['snapshotRoot'])
original = Path(meta['sourceRoot'])
snapshot_changed = [f for f, h in meta['files'].items() if sha(snapshot / f) != h]
original_changed = [f for f, h in meta['files'].items() if sha(original / f) != h]
verification = {
    'verifiedAt': now,
    'snapshotSourceChanged': snapshot_changed,
    'concurrentSourceDrift': original_changed,
    'auditSourceUnchanged': not snapshot_changed,
    'scope': 'The 377 source files captured in snapshot.json; concurrent additions are not enumerated.',
}
if snapshot_changed:
    errors.append({'sourceChanged': snapshot_changed})
(B / 'source-verification.json').write_text(json.dumps(verification, indent=2, ensure_ascii=False) + '\n')

for p in B.rglob('*'):
    if not p.is_file() or 'node_modules' in p.parts:
        continue
    try:
        if p.suffix in ('.json', '.cpuprofile'):
            data = json.loads(p.read_text())
            counts['json'] += 1
            if p.suffix == '.cpuprofile':
                assert data.get('nodes') and data.get('samples'), 'Empty CPU profile'
                counts['cpuProfile'] += 1
            if p.name == 'results.json':
                for req in data.get('network', []):
                    counts['networkRequests'] += 1
                    host = urllib.parse.urlsplit(req.get('origin', '')).hostname
                    if req.get('status') and host not in ('127.0.0.1', 'localhost', '::1'):
                        raise AssertionError('Response from an external origin: ' + str(host))
        elif p.suffix == '.zip':
            with zipfile.ZipFile(p) as archive:
                assert archive.testzip() is None, 'Corrupt ZIP member'
                assert any(x.endswith('.trace') for x in archive.namelist()), 'Missing trace stream'
            counts['traceZip'] += 1
        elif p.suffix == '.png':
            raw = p.read_bytes()
            assert raw[:8] == b'\x89PNG\r\n\x1a\n', 'Invalid PNG signature'
            pos, ended, image_data = 8, False, []
            while pos < len(raw):
                size = struct.unpack('>I', raw[pos:pos+4])[0]
                kind = raw[pos+4:pos+8]
                chunk = raw[pos+8:pos+8+size]
                crc = struct.unpack('>I', raw[pos+8+size:pos+12+size])[0]
                assert zlib.crc32(kind + chunk) & 0xffffffff == crc, 'PNG CRC mismatch'
                if kind == b'IDAT':
                    image_data.append(chunk)
                if kind == b'IEND':
                    ended = True
                    break
                pos += size + 12
            assert ended and zlib.decompress(b''.join(image_data)), 'Incomplete PNG'
            counts['png'] += 1
    except Exception as exc:
        errors.append({'file': str(p.relative_to(B)), 'error': str(exc)})

report = B / json.loads((B / 'latest-report.json').read_text())['directory']
required = [
    '00-environment-and-baseline.md', '01-frontend-performance.md',
    '02-backend-and-api.md', '03-database-and-realtime.md', '04-ai-performance.md',
    '05-reliability-and-error-handling.md', '06-user-journey-results.md',
    '07-root-cause-analysis.md', '08-prioritized-remediation-plan.md',
    'FINAL-PERFORMANCE-REPORT.md', 'findings.json',
]
for name in required:
    if not (report / name).is_file():
        errors.append({'missingDeliverable': name})
for p in report.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)', p.read_text()):
        target = target.split('#', 1)[0]
        target = re.sub(r':\d+$', '', target)  # Codex file links may include a line number.
        if target and not urllib.parse.urlsplit(target).scheme and not (p.parent / target).exists():
            errors.append({'file': str(p.relative_to(B)), 'brokenLink': target})

findings = json.loads((report / 'findings.json').read_text())['findings']
fields = [
    'id', 'priority', 'severity', 'confidence', 'affectedJourneys', 'validationStatus',
    'reproductionSteps', 'expectedBehavior', 'actualBehavior', 'measuredImpact',
    'rootCause', 'sourceFiles', 'evidence', 'recommendedRemediation',
    'acceptanceCriteria', 'estimatedComplexity', 'risks', 'regressionTests',
    'networkRequests', 'consoleErrors',
]
assert len({f['id'] for f in findings}) == len(findings), 'Duplicate finding IDs'
for f in findings:
    for field in fields:
        if field not in f or f[field] is None:
            errors.append({'finding': f['id'], 'missingField': field})
    for ref in f['evidence']:
        name, _, fragment = ref.partition('#')
        p = B / name
        if not p.is_file():
            errors.append({'finding': f['id'], 'missingEvidence': ref})
        elif fragment and p.suffix == '.json':
            try:
                data = json.loads(p.read_text())
                for part in fragment.split('/'):
                    data = data[int(part)] if isinstance(data, list) else data[part]
            except (KeyError, IndexError, ValueError, TypeError):
                errors.append({'finding': f['id'], 'missingEvidenceSection': ref})
    for ref in f['sourceFiles']:
        name, line = ref.rsplit(':', 1)
        p = snapshot / name
        if not p.is_file() or not 1 <= int(line) <= len(p.read_text().splitlines()):
            errors.append({'finding': f['id'], 'invalidSourceReference': ref})

result = {
    'validatedAt': now,
    'report': str(report.relative_to(B)),
    'artifactIntegrityPassed': not errors,
    'counts': counts,
    'findings': len(findings),
    'sourceVerification': verification,
    'successfulExternalBrowserResponses': 0 if not any('external origin' in str(e) for e in errors) else 'see errors',
    'errors': errors,
    'note': 'Artifact integrity is distinct from application performance thresholds. Recorded application failures remain findings.',
}
folder = B / 'verification'
folder.mkdir(exist_ok=True)
destination = folder / (now.replace(':', '-') + '.json')
destination.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(bool(errors))
