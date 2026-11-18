import {build} from 'esbuild';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {backendTemplate} from './template.mjs';
await mkdir('build',{recursive:true});
const entries=['api','import','auth','ai','worker','voice-monitor'];
for(const entry of entries){await build({entryPoints:[entry+'.mjs'],bundle:true,platform:'node',target:'node22',format:'esm',outfile:'build/'+entry+'.mjs',minify:true,banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});await rm('build/'+entry+'.zip',{force:true});const zipped=spawnSync('zip',['-q','-j','build/'+entry+'.zip','build/'+entry+'.mjs']);if(zipped.status!==0)throw Error('Packaging failed');}
await writeFile('build/template.json',JSON.stringify(backendTemplate(),null,2));
console.log('Built six independent Lambda bundles. No cloud calls.');
