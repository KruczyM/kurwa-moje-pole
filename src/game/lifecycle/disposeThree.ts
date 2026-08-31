import * as THREE from 'three';

const textureKeys=[
 'map','alphaMap','aoMap','bumpMap','displacementMap','emissiveMap','envMap',
 'lightMap','metalnessMap','normalMap','roughnessMap',
] as const;

export function cloneDisposableModel(source:THREE.Object3D){
 const model=source.clone(true);
 model.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh)return;
  mesh.geometry=mesh.geometry.clone();
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const clones=materials.map(material=>{
   const copy=material.clone();
   for(const key of textureKeys){
    const texture=(copy as unknown as Record<string,unknown>)[key];
    if(texture instanceof THREE.Texture)(copy as unknown as Record<string,unknown>)[key]=texture.clone();
   }
   return copy;
  });
  mesh.material=Array.isArray(mesh.material)?clones:clones[0];
 });
 return model;
}

export function disposeObjectTree(root:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 root.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh)return;
  geometries.add(mesh.geometry);
  const values=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  values.forEach(material=>{
   materials.add(material);
   for(const key of textureKeys){
    const texture=(material as unknown as Record<string,unknown>)[key];
    if(texture instanceof THREE.Texture)textures.add(texture);
   }
  });
 });
 textures.forEach(texture=>texture.dispose());
 materials.forEach(material=>material.dispose());
 geometries.forEach(geometry=>geometry.dispose());
 root.clear();
}
