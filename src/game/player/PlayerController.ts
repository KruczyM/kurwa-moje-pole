import * as THREE from 'three';
import {calculateLocalMove} from './movement';
import {EventScope} from '../lifecycle/EventScope';
export type PlayerModifiers={speed:number;sway:number;shake:number;bob:number};
export class PlayerController{
 keys=new Set<string>();yaw=0;pitch=0;enabled=false;private velocity=new THREE.Vector2();private bobTime=0;private readonly baseY=1.9;private events=new EventScope();private disposed=false;
 constructor(readonly camera:THREE.PerspectiveCamera,readonly canvas:HTMLCanvasElement,readonly canMove:(x:number,z:number)=>boolean){
  camera.position.set(0,this.baseY,15);
  this.events.listen(window,'keydown',event=>this.keys.add((event as KeyboardEvent).key.toLowerCase()));
  this.events.listen(window,'keyup',event=>this.keys.delete((event as KeyboardEvent).key.toLowerCase()));
  this.events.listen(canvas,'click',()=>{if(this.enabled)this.requestPointerLock()});
  this.events.listen(window,'mousemove',event=>{const mouse=event as MouseEvent;if(document.pointerLockElement===canvas&&this.enabled){this.yaw-=mouse.movementX*.0024;this.pitch=THREE.MathUtils.clamp(this.pitch-mouse.movementY*.002,-1.18,1.18)}});
 }
 private axis(positive:string[],negative:string[]){return Number(positive.some(k=>this.keys.has(k)))-Number(negative.some(k=>this.keys.has(k)))}
 update(dt:number,mod:PlayerModifiers){if(!this.enabled||document.pointerLockElement!==this.canvas)return;const forward=this.axis(['w','arrowup'],['s','arrowdown']);const right=this.axis(['d','arrowright'],['a','arrowleft']);const direction=calculateLocalMove(this.yaw,{forward,right});const run=this.keys.has('shift');const targetSpeed=(run?6:3.3)*mod.speed;const response=direction.x||direction.z?12:16;this.velocity.x=THREE.MathUtils.damp(this.velocity.x,direction.x*targetSpeed,response,dt);this.velocity.y=THREE.MathUtils.damp(this.velocity.y,direction.z*targetSpeed,response,dt);const nx=this.camera.position.x+this.velocity.x*dt,nz=this.camera.position.z+this.velocity.y*dt;if(this.canMove(nx,nz)){this.camera.position.x=nx;this.camera.position.z=nz}else{this.velocity.multiplyScalar(.15)}const moving=this.velocity.length();this.bobTime+=dt*moving*(mod.bob||1)*2.6;const bob=Math.sin(this.bobTime)*Math.min(.055,moving*.012);const shake=mod.shake?Math.sin(performance.now()*.025)*mod.shake*.012:0;this.camera.position.y=this.baseY+bob+shake;this.camera.rotation.set(this.pitch+shake+mod.sway*Math.sin(this.bobTime*.5),this.yaw,0,'YXZ')}
 stop(){this.velocity.set(0,0)}
 requestPointerLock(){if(!this.disposed&&document.pointerLockElement!==this.canvas)this.canvas.requestPointerLock().catch?.(()=>undefined)}
 dispose(){if(this.disposed)return;this.disposed=true;this.enabled=false;this.stop();this.keys.clear();this.events.dispose()}
}
