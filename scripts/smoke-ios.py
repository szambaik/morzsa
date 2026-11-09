"""Launch the built app on an already-installed simulator. Never downloads runtimes."""
import json, os, pathlib, subprocess, time
app = os.environ.get('MORZSA_IOS_APP', 'build/ios/Build/Products/Debug-iphonesimulator/App.app')
run = lambda *args: subprocess.check_output(['xcrun', 'simctl', *args], text=True)
devices = json.loads(run('list', 'devices', 'available', '-j'))['devices']
phones = [d for runtime, group in devices.items() if 'iOS' in runtime for d in group if d.get('isAvailable') and d['name'].startswith('iPhone')]
if not phones:
    raise SystemExit('No iOS simulator runtime/device installed. Install it in Xcode Settings > Components.')
device = phones[0]
if device['state'] != 'Booted': run('boot', device['udid'])
run('bootstatus', device['udid'], '-b')
run('install', device['udid'], app)
print(run('launch', device['udid'], 'io.github.szambaik.morzsa'))
time.sleep(5)
pathlib.Path('build/qa').mkdir(parents=True, exist_ok=True)
run('io', device['udid'], 'screenshot', 'build/qa/ios-launch.png')
print('iOS launch screenshot saved. This smoke check does not verify microphone or OAuth.')
