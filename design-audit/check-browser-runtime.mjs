// Fail closed if a package upgrade no longer matches the prepared CI image.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
for(const [name,engine] of Object.entries({chromium,webkit})){
 const executable=engine.executablePath();assert.ok(fs.existsSync(executable),'Missing '+name+' executable; update the pinned Playwright image with package-lock.json');
 const browser=await engine.launch({headless:true});console.log('Prepared '+name+' runtime: '+browser.version());await browser.close();
}
