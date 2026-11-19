import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {transform} from 'esbuild';

// Classic scripts intentionally share a global scope. Preserve names and exact order.
export async function bundleNativeRuntime(root,dest,html){
 const scriptTags=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)],groups=[[]];
 for(const [,attributes,inline] of scriptTags){
  const src=attributes.match(/\bsrc="([^"?]+)(?:\?[^"\s]*)?"/);
  // Preserve the microtask checkpoint before proactive startup. Otherwise earlier
  // async initializers all finish with suggestions mounted and repeat recipe ranking.
  if(src?.[1]==='proactive-model.js'&&groups.at(-1).length)groups.push([]);
  if(src){if(!/^[\w-]+\.js$/.test(src[1]))throw Error('Unexpected native script: '+src[1]);groups.at(-1).push(await readFile(path.join(root,src[1]),'utf8'))}
  else groups.at(-1).push(inline);
 }
 const compiledFiles=[];let sourceJavaScriptBytes=0,bundledJavaScriptBytes=0;
 for(const [index,group] of groups.entries()){
  const source=group.join('\n;\n'),file=index?'morzsa-suggestions.js':'morzsa-app.js';
  const compiled=await transform(source,{loader:'js',target:['safari15','chrome100'],minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:false,legalComments:'none',charset:'utf8'});
  await writeFile(path.join(dest,file),compiled.code);compiledFiles.push(file);sourceJavaScriptBytes+=Buffer.byteLength(source);bundledJavaScriptBytes+=Buffer.byteLength(compiled.code);
 }
 const links=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)],styles=[];
 for(const [link] of links){const file=link.match(/href="([^"?]+)/)?.[1];if(!file||!/^[\w-]+\.css$/.test(file))throw Error('Unexpected native stylesheet');styles.push(await readFile(path.join(root,file),'utf8'))}
 styles.push(await readFile(path.join(root,'mobile/ios.css'),'utf8'));
 // iOS uses its local system fonts: no remote font stylesheet, download, or reflow.
 const css=styles.join('\n').replace(/@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com\/[^)]*\)\s*;/g,'').replace(/(['"]?)(Inter|Sora|Nunito Sans)\1/g,'-apple-system');
 const compiledCSS=await transform(css,{loader:'css',minify:true,target:['safari15','chrome100'],legalComments:'none'});
 await writeFile(path.join(dest,'morzsa-app.css'),compiledCSS.code);
 for(const [tag] of scriptTags)html=html.replace(tag,'');
 for(const [tag] of links)html=html.replace(tag,'');
 html=html.replace('</head>','<link rel="stylesheet" href="morzsa-app.css"></head>');
 html=html.replace('</body>','<script src="native-bridge.js"></script>'+compiledFiles.map(file=>'<script src="'+file+'"></script>').join('')+'</body>');
 const report={scriptTagsBefore:scriptTags.length,scriptTagsAfter:compiledFiles.length+1,stylesheetsBefore:links.length,stylesheetsAfter:1,sourceJavaScriptBytes,bundledJavaScriptBytes,sourceCSSBytes:Buffer.byteLength(styles.join('\n')),bundledCSSBytes:Buffer.byteLength(compiledCSS.code),remoteFonts:false};
 await writeFile(path.join(dest,'native-build-report.json'),JSON.stringify(report,null,2)+'\n');
 return html;
}
