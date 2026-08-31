type EventSource={
 addEventListener(type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions):void;
 removeEventListener(type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions):void;
};

export class EventScope{
 private cleanups:(()=>void)[]=[];
 listen(source:EventSource,type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions){
  source.addEventListener(type,listener,options);
  const capture=typeof options==='boolean'?options:options?.capture;
  this.cleanups.push(()=>source.removeEventListener(type,listener,capture));
 }
 dispose(){
  for(let index=this.cleanups.length-1;index>=0;index--)this.cleanups[index]();
  this.cleanups.length=0;
 }
 get size(){return this.cleanups.length}
}
