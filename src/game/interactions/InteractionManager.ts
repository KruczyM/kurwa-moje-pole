import * as THREE from 'three';
export class InteractionManager{
 private raycaster=new THREE.Raycaster();private target:THREE.Object3D|null=null;
 constructor(private readonly camera:THREE.Camera,private readonly roots:()=>THREE.Object3D[]){}
 update(){this.raycaster.setFromCamera(new THREE.Vector2(),this.camera);const hit=this.raycaster.intersectObjects(this.roots(),true).find(item=>item.distance<3.4);const next=hit?this.findRoot(hit.object):null;if(next!==this.target){if(this.target)this.highlight(this.target,false);this.target=next;if(this.target)this.highlight(this.target,true)}return this.target?.userData.interaction||null}
 get current(){return this.target?.userData.interaction||null}
 private findRoot(object:THREE.Object3D){let current:THREE.Object3D|null=object;while(current&&!current.userData.interaction)current=current.parent;return current}
 private highlight(root:THREE.Object3D,on:boolean){root.traverse(object=>{const material=(object as THREE.Mesh).material;if(material instanceof THREE.MeshStandardMaterial){material.emissive.setHex(on?0x233c16:0);material.emissiveIntensity=on?.25:0}})}
}
