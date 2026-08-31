export type AppState=
 |'start'
 |'loading'
 |'playing'
 |'inspecting'
 |'dialog'
 |'inventory'
 |'paused'
 |'error';

export type StateChange={from:AppState;to:AppState};
type Listener=(change:StateChange)=>void;

const transitions:Record<AppState,readonly AppState[]>={
 start:['loading'],
 loading:['playing','error','start'],
 playing:['inspecting','dialog','inventory','paused','error','start'],
 inspecting:['playing','error','start'],
 dialog:['playing','error','start'],
 inventory:['playing','error','start'],
 paused:['playing','error','start'],
 error:['loading','start'],
};

export const modalStates:readonly AppState[]=['inspecting','dialog','inventory','paused'];

export function escapeTarget(state:AppState):AppState|null{
 if(state==='inspecting'||state==='dialog'||state==='inventory')return'playing';
 if(state==='playing')return'paused';
 if(state==='paused')return'playing';
 return null;
}

export class AppStateMachine{
 private listeners=new Set<Listener>();
 constructor(private value:AppState='start'){}
 get current(){return this.value}
 canTransition(to:AppState){return to===this.value||transitions[this.value].includes(to)}
 transition(to:AppState){
  if(to===this.value)return false;
  if(!this.canTransition(to))throw new Error(`Invalid app state transition: ${this.value} -> ${to}`);
  const change={from:this.value,to};
  this.value=to;
  this.listeners.forEach(listener=>listener(change));
  return true;
 }
 subscribe(listener:Listener){this.listeners.add(listener);return()=>this.listeners.delete(listener)}
}
