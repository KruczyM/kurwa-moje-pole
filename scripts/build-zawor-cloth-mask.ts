import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const b=readFileSync('public/game-assets/characters/zawor/npc-animations.glb');
const l=new GLTFLoader();l.register(()=>({name:'images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const model=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
model.scene.updateMatrixWorld(true);
model.scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
const box=new THREE.Box3().setFromObject(model.scene),h=box.max.y-box.min.y;
const colors=JSON.parse(readFileSync('reports/zawor-cloth-analysis/colors.json','utf8')) as number[][][];
const poses: unknown[]=[];const masks: unknown[]=[];
let m=0;
model.scene.traverse(mesh=>{
 if(!(mesh instanceof THREE.SkinnedMesh))return;
 const p=mesh.geometry.getAttribute('position'), ix=mesh.geometry.index!;
 const vertices=Array.from({length:p.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
 const selected:number[]=[];
 vertices.forEach((p,i)=>{
   const x=Math.abs(p.x)/h, y=(p.y-box.min.y)/h;
   const [r,g,b]=colors[m][i];
   if(y>.24 && y<.63 && x<.32 && (Math.max(r,g,b)<145 || (r>g*1.3 && g<125 && b<90)))selected.push(i);
 });
 const faces=Array.from({length:ix.count/3},(_,i)=>[ix.getX(i*3),ix.getX(i*3+1),ix.getX(i*3+2)]);
 // Close small texture holes, including duplicated vertices at UV seams.
 const neighbours=Array.from({length:p.count},()=>new Set<number>());
 for(const face of faces)for(const a of face)for(const b of face)if(a!==b)neighbours[a].add(b);
 const welded=new Map<string,number[]>();
 vertices.forEach((v,i)=>{const k=v.toArray().map(n=>n.toFixed(10)).join(',');const list=welded.get(k)??[];list.push(i);welded.set(k,list);});
 for(const list of welded.values())for(const a of list)for(const b of list)if(a!==b)neighbours[a].add(b);
 const mask=new Set(selected);
 for(let pass=0;pass<12;pass++){
   const added:number[]=[];
   vertices.forEach((v,i)=>{
     if(mask.has(i))return;
     const y=(v.y-box.min.y)/h,x=Math.abs(v.x)/h;
     const [r,g,b]=colors[m][i];
     // Yellow shorts and skin must not be absorbed by cloth dilation.
     const dark=Math.max(r,g,b)<175 || (r>g*1.2 && g<150 && b<110);
     const ns=[...neighbours[i]], hits=ns.filter(n=>mask.has(n)).length;
     if(y>.24 && y<.63 && x<.32 && ((dark && hits>0) || (hits>=2 && hits/ns.length>=.5)))added.push(i);
   });
   added.forEach(i=>mask.add(i));
 }
 selected.splice(0,selected.length,...mask);
 const hash=createHash('sha256').update(Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength)).digest('hex');
 poses.push({name:'cloth mask',vertices:vertices.map(v=>v.toArray()),faces,selected});
 masks.push({positionSha256:hash,count:p.count,vertices:selected});
 console.log('cloth vertices',selected.length);m++;
});
mkdirSync('reports/zawor-cloth-analysis',{recursive:true});
writeFileSync('reports/zawor-cloth-analysis/poses.json',JSON.stringify(poses));
writeFileSync('reports/zawor-cloth-analysis/mask.json',JSON.stringify(masks));
