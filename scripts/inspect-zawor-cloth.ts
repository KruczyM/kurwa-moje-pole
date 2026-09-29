import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const b=readFileSync('public/game-assets/characters/zawor/npc-animations.glb');
const l=new GLTFLoader();l.register(()=>({name:'images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const model=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
model.scene.updateMatrixWorld(true);
model.scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
const box=new THREE.Box3().setFromObject(model.scene),h=box.max.y-box.min.y;
model.scene.traverse(mesh=>{
 if(!(mesh instanceof THREE.SkinnedMesh))return;
 const p=mesh.geometry.getAttribute('position'), ix=mesh.geometry.index!;
 const parent=Array.from({length:p.count},(_,i)=>i);
 const find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
 const join=(a:number,b:number)=>{parent[find(a)]=find(b);};
 const exact=new Map<string,number>();
 for(let i=0;i<p.count;i++){const k=`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;const old=exact.get(k);if(old!==undefined)join(i,old);else exact.set(k,i);}
 for(let i=0;i<ix.count;i+=3){join(ix.getX(i),ix.getX(i+1));join(ix.getX(i),ix.getX(i+2));}
 const groups=new Map<number,number[]>();for(let i=0;i<p.count;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r)!.push(i);}
 console.log('components',groups.size);
 console.log([...groups.values()].filter(v=>v.length>10).map(v=>{const bounds=new THREE.Box3();for(const i of v){const q=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);q.y-=box.min.y;q.divideScalar(h);bounds.expandByPoint(q);}return {count:v.length,min:bounds.min.toArray(),max:bounds.max.toArray()};}).sort((a,b)=>b.count-a.count).slice(0,100));
});
