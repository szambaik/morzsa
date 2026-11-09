import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),dest=path.join(root,'dist');
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
let html=await readFile(path.join(root,'index.html'),'utf8');
const files=new Set([...html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)].map(m=>m[1]).filter(p=>/^[\w-]+\.(js|css)$/.test(p)));
// Only entry-point runtime files and curated artwork belong in the application.
for(const file of files)await cp(path.join(root,file),path.join(dest,file));
await cp(path.join(root,'assets'),path.join(dest,'assets'),{recursive:true,filter:src=>!path.basename(src).startsWith('.')});
await build({entryPoints:[path.join(root,'mobile/bridge.js')],bundle:true,format:'iife',outfile:path.join(dest,'native-bridge.js'),target:['safari15','chrome100'],minify:true});
html=html.replace('<script src="catalog.js','<script src="native-bridge.js"></script><script src="catalog.js');
await writeFile(path.join(dest,'index.html'),html);
for(const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)){if(!match[1].startsWith('#')&&!match[1].includes('://'))await readFile(path.join(dest,match[1]));}
console.log('Mobile web bundle created with '+files.size+' runtime files and curated assets.');
