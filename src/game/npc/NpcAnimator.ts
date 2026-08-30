import * as THREE from 'three';
export class NpcAnimator{
 readonly mixer:THREE.AnimationMixer;private actions=new Map<string,THREE.AnimationAction>();private current='';private walkTimeScale=0.78;
 constructor(root:THREE.Object3D,clips:THREE.AnimationClip[]){this.mixer=new THREE.AnimationMixer(root);for(const clip of clips)this.actions.set(clip.name,this.mixer.clipAction(clip));this.play('Idle',0)}
 setWalkTimeScale(scale:number){this.walkTimeScale=scale;const walk=this.actions.get('Walk');if(walk)walk.setEffectiveTimeScale(scale)}
 play(name:'Idle'|'Walk'|'Run',fade=.2){
  if(name===this.current)return;const next=this.actions.get(name);if(!next)return;const previous=this.actions.get(this.current);previous?.fadeOut(fade);next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();this.current=name}
 update(deltaTime:number){this.mixer.update(deltaTime)}
 dispose(){this.mixer.stopAllAction();this.actions.clear()}
}
