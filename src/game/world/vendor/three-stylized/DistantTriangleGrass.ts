import * as THREE from 'three';
/** Low-detail full-map layer: fills the horizon while the tutorial layer is dense near the player. */
export class DistantTriangleGrass extends THREE.Mesh {
 constructor(){
  const count=90000,extent=58.5,p=new Float32Array(count*9),c=new Float32Array(count*9),yaw=new Float32Array(count*9);let seed=171;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<count;i++){const x=rnd()*extent*2-extent,z=rnd()*extent*2-extent,a=rnd()*Math.PI*2;for(let v=0;v<3;v++){const o=(i*3+v)*3;p[o]=x;p[o+1]=0;p[o+2]=z;yaw[o]=Math.sin(a);yaw[o+2]=-Math.cos(a);c[o]=v===0?.1:0;c[o+1]=v===2?1:0;c[o+2]=v===1?.1:0}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));g.setAttribute('aYaw',new THREE.BufferAttribute(yaw,3));const time={value:0};
  const m=new THREE.ShaderMaterial({vertexColors:true,side:THREE.DoubleSide,uniforms:{uTime:time},vertexShader:`attribute vec3 aYaw;uniform float uTime;varying float vTip;float terrain(vec2 p){return .18*sin(p.x*.065)*cos(p.y*.055)+.09*sin(p.x*.19+p.y*.13);}void main(){vec3 q=position;q.y=terrain(q.xz);float tip=color.g;float side=color.r>.05?1.:color.b>.05?-1.:0.;float h=.12+fract(sin(dot(position.xz,vec2(12.9898,78.233)))*43758.5)*.18;q+=aYaw*side*.007;q.y+=tip*h;float wind=sin(uTime*.5+q.x*.2+q.z*.15)*.018*tip*tip;q.x+=wind;q.z+=wind*.5;vTip=tip;gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`,fragmentShader:`varying float vTip;void main(){gl_FragColor=vec4(mix(vec3(.018,.12,.045),vec3(.16,.42,.10),vTip),1.);}`});
  super(g,m);this.name='DistantTriangleGrass';this.frustumCulled=false;this.onBeforeRender=()=>time.value=performance.now()*.001;
 }
}
