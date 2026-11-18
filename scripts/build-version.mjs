import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export async function buildVersion(root,html,target,backend='supabase'){
 const git=(...args)=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()}catch{return ''}};
 const commit=process.env.GITHUB_SHA||git('rev-parse','HEAD');
 const digest=createHash('sha256').update(html).update(target).update(backend);
 const files=[...new Set([...html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)].map(m=>m[1]).filter(p=>/^[\w-]+\.(js|css)$/.test(p)))].sort();
 for(const file of files)digest.update(file).update(await readFile(path.join(root,file)));
 const fingerprint=digest.digest('hex').slice(0,8);
 return {backend,commit,shortCommit:commit.slice(0,7),fingerprint,builtAt:new Date().toISOString(),target,localChanges:!process.env.GITHUB_SHA&&!!git('status','--porcelain','--untracked-files=no')};
}
