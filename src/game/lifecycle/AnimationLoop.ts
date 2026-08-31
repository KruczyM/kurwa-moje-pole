export type FrameScheduler=(callback:FrameRequestCallback)=>number;
export type FrameCanceller=(handle:number)=>void;

export class AnimationLoop{
 private handle=0;
 private running=false;
 constructor(
  private readonly update:FrameRequestCallback,
  private readonly schedule:FrameScheduler=callback=>requestAnimationFrame(callback),
  private readonly cancel:FrameCanceller=handle=>cancelAnimationFrame(handle),
 ){}
 start(){
  if(this.running)return false;
  this.running=true;
  this.handle=this.schedule(this.tick);
  return true;
 }
 stop(){
  if(!this.running)return false;
  this.running=false;
  this.cancel(this.handle);
  this.handle=0;
  return true;
 }
 private tick:FrameRequestCallback=time=>{
  if(!this.running)return;
  this.handle=this.schedule(this.tick);
  this.update(time);
 };
 get active(){return this.running}
}
