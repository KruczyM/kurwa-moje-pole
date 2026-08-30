// Based on Peter Adams' "Making Grass with Triangles in GLSL using Three.js".
import * as THREE from 'three';
export class TutorialTriangleGrass extends THREE.Mesh {
 private time:{value:number};private player:{value:THREE.Vector3};
 constructor(){
  // 52 x 52 is twice the surface of the former 36.8 x 36.8 moving tile.
  // Blade count doubles too, preserving the current close-up density.
  const count=946400, positions=new Float32Array(count*9), colors=new Float32Array(count*9), yaws=new Float32Array(count*9);let seed=97;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<count;i++){const x=rand()*42-21,z=rand()*42-21,yaw=rand()*Math.PI*2;for(let v=0;v<3;v++){const o=(i*3+v)*3;positions[o]=x;positions[o+1]=.012;positions[o+2]=z;yaws[o]=Math.sin(yaw);yaws[o+1]=0;yaws[o+2]=-Math.cos(yaw);colors[o]=v===0?.1:0;colors[o+1]=v===2?1:0;colors[o+2]=v===1?.1:0}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setAttribute('aYaw',new THREE.BufferAttribute(yaws,3));
  const time={value:0},player={value:new THREE.Vector3()};const mat=new THREE.ShaderMaterial({vertexColors:true,side:THREE.DoubleSide,uniforms:{uTime:time,uPlayerPosition:player},vertexShader:`attribute vec3 aYaw;uniform float uTime;uniform vec3 uPlayerPosition;varying float vTip;varying float vShade;float terrain(vec2 p){return .18*sin(p.x*.065)*cos(p.y*.055)+.09*sin(p.x*.19+p.y*.13);}void main(){vec3 p=position;vec2 origin=mod(position.xz-uPlayerPosition.xz+26.0,52.0)-26.0;p.xz=uPlayerPosition.xz+origin;p.y=terrain(p.xz);float tip=color.g;float side=color.r>.05?1.:color.b>.05?-1.:0.;float n=fract(sin(dot(position.xz,vec2(12.9898,78.233)))*43758.5);float h=.21+n*.29;p+=aYaw*side*.009;p.y+=tip*h;float w=(sin(uTime*.72+p.x*.42+p.z*.29)+sin(uTime*.31+p.z*.74))*.035*tip*tip;p.x+=w;p.z+=w*.6;vTip=tip;vShade=n;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying float vTip;varying float vShade;void main(){vec3 dark=vec3(.015,.10,.045),mid=vec3(.035,.30,.10),light=vec3(.18,.58,.10);vec3 col=mix(mix(dark,mid,vShade),light,vTip*.7);gl_FragColor=vec4(col,1.);}`});
  super(geo,mat);this.name='TutorialTriangleGrass';this.time=time;this.player=player;this.frustumCulled=false;this.onBeforeRender=(_renderer,_scene,camera)=>{this.time.value=performance.now()*.001;this.player.value.copy(camera.position)};
 }
}
