/** Read-only inventory; never removes or stages anything. */
import { execFileSync } from 'node:child_process';
import { readdirSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const primary='E:/kodowanie/gra';
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const roots=git(primary,'worktree','list','--porcelain').split('\n').filter(l=>l.startsWith('worktree ')).map(l=>l.slice(9).trim());
const rows=[];
for(const root of roots){
  const row={root,branch:git(root,'branch','--show-current').trim(),head:git(root,'rev-parse','HEAD').trim(),status:git(root,'status','--porcelain=v1','--untracked-files=all'),uniqueCommits:git(root,'log','--oneline','feat/festival-next..HEAD'),ignored:git(root,'ls-files','--others','--ignored','--exclude-standard','--directory').split('\n').filter(Boolean),bytes:0,files:0,links:[],largest:[],top:{}};
  if(root!==primary && !root.endsWith('/festival-2026-tent-upgrades')){
    const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,entry.name),rel=relative(root,path).replaceAll('\\','/');if(entry.name==='.git')continue;const stat=lstatSync(path);if(stat.isSymbolicLink()){row.links.push(rel);continue;}if(entry.isDirectory()){walk(path);continue;}if(!stat.isFile())continue;row.bytes+=stat.size;row.files++;const top=rel.split('/')[0];row.top[top]=(row.top[top]??0)+stat.size;if(stat.size>20*1024*1024)row.largest.push({path:rel,bytes:stat.size});}};
    walk(root);
  }
  rows.push(row);console.log(`${row.root}: ${(row.bytes/1024**3).toFixed(2)} GiB; ${row.status.split('\n').filter(Boolean).length} local changes; ignored: ${row.ignored.join(', ')}`);
}
const output=resolve('reports/worktree-consolidation-20260927');mkdirSync(output,{recursive:true});writeFileSync(`${output}/inventory.json`,JSON.stringify(rows,null,2));
