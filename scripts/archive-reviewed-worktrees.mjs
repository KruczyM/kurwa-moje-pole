/** Local preservation step only; removal is a separate, explicitly reviewed operation. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
const primary='E:/kodowanie/gra';
const active=resolve('.');
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const inventory=JSON.parse(readFileSync('reports/worktree-consolidation-20260927/inventory.json'));
const archive=resolve(primary,'.ai/archive/worktrees-20260927');mkdirSync(archive,{recursive:true});
const common=resolve(primary,git(primary,'rev-parse','--git-common-dir').trim());
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const checked=new Set(), results=[];
for(const row of inventory){
  const root=resolve(row.root);
  if(root===active||root===resolve(primary))continue;
  const normalized=root.replaceAll('\\','/');
  if(!/^E:\/kodowanie\/(?:gra-issue-\d+|gra\/\.ai\/worktrees\/issue-[a-z0-9-]+)$/.test(normalized))throw new Error(`Unapproved target ${root}`);
  if(realpathSync(root).toLowerCase()!==root.toLowerCase())throw new Error(`Redirected target ${root}`);
  if(git(root,'status','--porcelain=v1','--untracked-files=all')!==row.status||git(root,'rev-parse','HEAD').trim()!==row.head)throw new Error(`Changed since inventory: ${root}`);
  const folder=resolve(archive,normalized.split('/').at(-1));mkdirSync(folder,{recursive:true});
  const copied=[];
  const preserve=file=>{const rel=relative(root,file);if(rel.startsWith('..'))throw new Error('Outside source');const dest=resolve(folder,'files',rel);mkdirSync(dirname(dest),{recursive:true});copyFileSync(file,dest);const sha256=hash(file);if(hash(dest)!==sha256)throw new Error('Backup mismatch');copied.push({path:rel,sha256});};
  // Dirty tracked and untracked files are preserved verbatim, plus patches for
  // index/working-tree distinctions. Deleted files remain recoverable at HEAD.
  const local=git(root,'ls-files','--modified','--others','--exclude-standard','-z').split('\0').filter(Boolean);
  for(const rel of new Set(local)){const path=resolve(root,rel);if(existsSync(path)&&lstatSync(path).isFile())preserve(path);}
  writeFileSync(resolve(folder,'working.patch'),git(root,'diff','--binary','--no-ext-diff'));
  writeFileSync(resolve(folder,'staged.patch'),git(root,'diff','--cached','--binary','--no-ext-diff'));
  const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=resolve(dir,entry.name);if(lstatSync(file).isSymbolicLink())throw new Error(`Ignored symlink needs separate review: ${file}`);if(entry.isDirectory())walk(file);else preserve(file);}};
  for(const rel of row.ignored){
    if(/^(?:node_modules|dist|\.vite)\//.test(rel)||/(?:^|\/)__pycache__\//.test(rel))continue;
    if(/(?:^|\/)\.env(?:$|\.)/.test(rel))throw new Error('Private configuration needs separate handling');
    const file=resolve(root,rel);if(lstatSync(file).isDirectory())walk(file);else preserve(file);
  }
  // Removing a hydrated worktree is safe only when every LFS payload remains
  // in the shared local store: the remote quota may prevent downloading it.
  for(const line of git(root,'lfs','ls-files','--long').split('\n')){
    const match=/^([a-f0-9]{64}) [*-] (.+)$/.exec(line.trim());if(!match)continue;
    const [,oid,path]=match;if(checked.has(oid))continue;
    const cache=resolve(common,'lfs/objects',oid.slice(0,2),oid.slice(2,4),oid);
    if(!existsSync(cache)){const source=resolve(root,path);if(!existsSync(source)||hash(source)!==oid)throw new Error(`Missing recoverable LFS object ${path}`);mkdirSync(dirname(cache),{recursive:true});copyFileSync(source,cache);}
    if(hash(cache)!==oid)throw new Error(`Corrupt LFS object ${oid}`);checked.add(oid);
  }
  const ref=`archive/worktrees-20260927/${normalized.split('/').at(-1)}`;
  try{git(primary,'show-ref','--verify','--quiet',`refs/heads/${ref}`);}catch{git(primary,'branch',ref,row.head);}
  if(git(primary,'rev-parse',ref).trim()!==row.head)throw new Error('Archive branch mismatch');
  if(git(root,'status','--porcelain=v1','--untracked-files=all')!==row.status)throw new Error(`Changed during preservation: ${root}`);
  const result={...row,archive:folder,archiveRef:ref,copied};writeFileSync(resolve(folder,'manifest.json'),JSON.stringify(result,null,2));results.push(result);
  console.log(`Preserved ${normalized}: ${copied.length} local files; ${ref}`);
}
writeFileSync(resolve(archive,'removal-plan.json'),JSON.stringify(results,null,2));
git(primary,'bundle','create',resolve(archive,'history.bundle'),'--all');
console.log(`Preserved ${results.length} worktrees and verified ${checked.size} shared LFS objects. No directories removed.`);
