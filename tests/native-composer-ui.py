"""Run real UITextView UI tests in an isolated copy of a built simulator app.

Usage: python3 tests/native-composer-ui.py --app /path/to/App.app --output /tmp/evidence
No production account, microphone session or provider request is used.
"""
import argparse
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--app', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--device')
args = parser.parse_args()
os.environ.setdefault('DEVELOPER_DIR', '/Applications/Xcode.app/Contents/Developer')
args.output.mkdir(parents=True, exist_ok=True)
sim = lambda *parts: subprocess.check_output(['xcrun', 'simctl', *parts], text=True)
devices = [d for rows in json.loads(sim('list', 'devices', 'available', '-j'))['devices'].values() for d in rows if 'iPhone' in d['name']]
device = args.device or next((d['udid'] for d in devices if d['state'] == 'Booted'), devices[0]['udid'])
if not any(d['udid'] == device and d['state'] == 'Booted' for d in devices):
    sim('boot', device)
sim('bootstatus', device, '-b')
bundle = 'io.github.szambaik.morzsa.composerqa'

with tempfile.TemporaryDirectory(prefix='morzsa-native-composer-') as temp:
    root = Path(temp)
    app = root / 'MorzsaComposerQA.app'
    subprocess.run(['ditto', '--norsrc', '--noextattr', str(args.app), str(app)], check=True)
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    info['CFBundleIdentifier'] = bundle
    info['CFBundleDisplayName'] = 'Morzsa Composer QA'
    (app / 'Info.plist').write_bytes(plistlib.dumps(info))
    config = json.loads((app / 'capacitor.config.json').read_text())
    config['appId'] = bundle
    (app / 'capacitor.config.json').write_text(json.dumps(config))
    html = (app / 'public/index.html').read_text()
    preamble = '''<script>localStorage.clear();localStorage.setItem('morzsa-introduction-v1','done');
    const qaFetch=window.fetch;window.fetch=(input,options)=>/^https?:/i.test(String(input?.url||input))?Promise.reject(Error('External traffic disabled for native UI QA')):qaFetch(input,options);</script>'''
    fixture = r'''<script>setTimeout(()=>{
      const tools=document.createElement('div');tools.style='position:fixed;top:80px;right:16px;z-index:9000;font-size:12px';
      tools.innerHTML='<p id="qa-sent" role="status" style="white-space:pre-wrap"></p>';document.body.append(tools);
      function bind(){const form=document.getElementById('companion-form');if(!form)return;
        form.onsubmit=e=>{e.preventDefault();const input=document.getElementById('companion-input');document.getElementById('qa-sent').textContent='Sent: '+input.value;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));MorzsaCompanion.render();bind()};}
      let redrawn=false;document.addEventListener('input',e=>{if(e.target.id==='companion-input'&&e.target.value==='Native draft\nSecond line'&&!redrawn){redrawn=true;setTimeout(()=>{MorzsaCompanion.render();bind();document.getElementById('qa-sent').textContent='Redraw complete'},750)}});bind();
    },2000)</script>'''
    html = html.replace('<script src="native-bridge.js">', preamble + '<script src="native-bridge.js">').replace('</body>', fixture + '</body>')
    (app / 'public/index.html').write_text(html)
    sim('install', device, str(app))

    # A stand-alone XCUITest runner launches the isolated bundle installed above.
    project = root / 'ComposerTests.xcodeproj'
    (project / 'xcshareddata/xcschemes').mkdir(parents=True)
    shutil.copyfile(Path(__file__).with_suffix('.swift'), root / 'ComposerTests.swift')
    (project / 'project.pbxproj').write_text('''// !$*UTF8*$!
    {archiveVersion=1;classes={};objectVersion=56;objects={
    A1={isa=PBXFileReference;lastKnownFileType=sourcecode.swift;path=ComposerTests.swift;sourceTree="<group>";};
    A2={isa=PBXFileReference;explicitFileType=wrapper.cfbundle;path=ComposerTests.xctest;sourceTree=BUILT_PRODUCTS_DIR;};
    A3={isa=PBXBuildFile;fileRef=A1;};
    A4={isa=PBXSourcesBuildPhase;buildActionMask=2147483647;files=(A3,);runOnlyForDeploymentPostprocessing=0;};
    A5={isa=PBXFrameworksBuildPhase;buildActionMask=2147483647;files=();runOnlyForDeploymentPostprocessing=0;};
    A6={isa=PBXResourcesBuildPhase;buildActionMask=2147483647;files=();runOnlyForDeploymentPostprocessing=0;};
    A7={isa=PBXNativeTarget;name=ComposerTests;productName=ComposerTests;productReference=A2;productType="com.apple.product-type.bundle.ui-testing";buildConfigurationList=A8;buildPhases=(A4,A5,A6,);buildRules=();dependencies=();};
    A8={isa=XCConfigurationList;buildConfigurations=(A9,);defaultConfigurationIsVisible=0;defaultConfigurationName=Debug;};
    A9={isa=XCBuildConfiguration;name=Debug;buildSettings={GENERATE_INFOPLIST_FILE=YES;PRODUCT_BUNDLE_IDENTIFIER=io.github.szambaik.morzsa.composerqa.tests;PRODUCT_NAME="$(TARGET_NAME)";SDKROOT=iphonesimulator;SUPPORTED_PLATFORMS=iphonesimulator;SWIFT_VERSION=5.0;IPHONEOS_DEPLOYMENT_TARGET=15.0;TARGETED_DEVICE_FAMILY="1,2";CODE_SIGNING_ALLOWED=NO;};};
    B0={isa=PBXProject;attributes={LastUpgradeCheck=1600;};buildConfigurationList=B3;compatibilityVersion="Xcode 14.0";developmentRegion=en;knownRegions=(en,Base,);mainGroup=B1;productRefGroup=B2;projectDirPath="";projectRoot="";targets=(A7,);};
    B1={isa=PBXGroup;children=(A1,B2,);sourceTree="<group>";};
    B2={isa=PBXGroup;name=Products;children=(A2,);sourceTree="<group>";};
    B3={isa=XCConfigurationList;buildConfigurations=(B4,);defaultConfigurationIsVisible=0;defaultConfigurationName=Debug;};
    B4={isa=XCBuildConfiguration;name=Debug;buildSettings={SDKROOT=iphonesimulator;};};
    };rootObject=B0;}''')
    reference = '<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A7" BuildableName="ComposerTests.xctest" BlueprintName="ComposerTests" ReferencedContainer="container:ComposerTests.xcodeproj"/>'
    (project / 'xcshareddata/xcschemes/ComposerTests.xcscheme').write_text('''<?xml version="1.0" encoding="UTF-8"?>
    <Scheme LastUpgradeVersion="1600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">''' + reference + '''</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">''' + reference + '''</TestableReference></Testables></TestAction></Scheme>''')
    with (args.output / 'xctest.log').open('w') as log:
        result = subprocess.run(['xcodebuild', '-project', str(project), '-scheme', 'ComposerTests', '-destination', 'platform=iOS Simulator,id=' + device, '-derivedDataPath', str(root / 'build'), '-resultBundlePath', str(args.output / 'NativeComposer.xcresult'), 'test'], stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        print((args.output / 'xctest.log').read_text()[-7000:])
        raise SystemExit(result.returncode)
    print('Native UITextView UI test passed: ' + str(args.output / 'NativeComposer.xcresult'))
