import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {transform} from 'esbuild';

// Classic scripts share globals with inline handlers. Preserve names and order.
// With no output format, esbuild preserves top-level identifiers used by the app.
// This web-only step does not change the native bridge or native packaging.
export async function bundleWebRuntime(root,dest,html){
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],sources=[];
 for(const [,attributes,inline] of scripts){
  if(/\btype=/.test(attributes))throw Error('Review non-classic script before bundling');
  const src=attributes.match(/\bsrc="([^"?]+)(?:\?[^"\s]*)?"/);
  if(src){if(!/^[\w-]+\.js$/.test(src[1]))throw Error('Unexpected web script: '+src[1]);sources.push(await readFile(path.join(root,src[1]),'utf8'))}
  else sources.push(inline);
 }
 const source=sources.join('\n;\n');
 const js=await transform(source,{loader:'js',target:['safari15','chrome100'],minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:true,legalComments:'none'});
 const links=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)],styles=[];
 for(const [tag] of links){const file=tag.match(/href="([^"?]+)/)?.[1];if(!file||!/^[\w-]+\.css$/.test(file))throw Error('Unexpected web stylesheet');styles.push(await readFile(path.join(root,file),'utf8'))}
 const css=await transform(styles.join('\n'),{loader:'css',target:['safari15','chrome100'],minify:true,legalComments:'none'});
 const asset=(kind,code)=>'morzsa-web-'+createHash('sha256').update(code).digest('hex').slice(0,12)+'.'+kind;
 const script=asset('js',js.code),style=asset('css',css.code);
 await writeFile(path.join(dest,script),js.code);await writeFile(path.join(dest,style),css.code);
 for(const [tag] of scripts)html=html.replace(tag,'');
 for(const [tag] of links)html=html.replace(tag,'');
 html=html.replace('</head>','<link rel="stylesheet" href="'+style+'"></head>');
 html=html.replace('</body>','<script defer src="'+script+'"></script></body>');
 await writeFile(path.join(dest,'web-build-report.json'),JSON.stringify({scriptsBefore:scripts.length,scriptsAfter:1,stylesheetsBefore:links.length,stylesheetsAfter:1,sourceJSBytes:Buffer.byteLength(source),jsBytes:Buffer.byteLength(js.code),sourceCSSBytes:Buffer.byteLength(styles.join('\n')),cssBytes:Buffer.byteLength(css.code),script,style},null,2)+'\n');
 return html;
}
