import * as THREE from 'three';
export type ArenaTheme='church'|'mall'|'basketball'|'rooftop';

/** Static, world-scale brushwork. Generated only when an arena is constructed. */
export function paintArenaPatina(c:CanvasRenderingContext2D,theme:ArenaTheme):void {
 let seed=9041;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const outdoor=theme==='rooftop'||theme==='basketball';
 // Asymmetric islands of wear, concentrated outside the central fighting lane.
 for(let i=0;i<85;i++){
  const x=random()*2048,y=i%2?random()*120:392+random()*120,r=8+random()*55;
  c.fillStyle=i%3===0?'#eadbb719':'#17232716';c.beginPath();
  for(let j=0;j<9;j++){const a=j*Math.PI*2/9,rr=r*(.5+random()*.5);const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*.45;if(j===0)c.moveTo(px,py);else c.lineTo(px,py);}c.closePath();c.fill();
  if(outdoor&&i%5===0){
   c.strokeStyle='#28323055';c.lineWidth=1.4;c.beginPath();c.moveTo(x,y);
   for(let j=1;j<5;j++)c.lineTo(x+j*7,y+j*3+(random()-.5)*12);c.stroke();
  }
 }
 // Gentle, broad gradients prevent a patchwork grid from dominating the surface.
 for(const x of [480,1568]){
  const g=c.createRadialGradient(x,135,0,x,135,185);
  g.addColorStop(0,theme==='basketball'?'#b6edff35':'#ffe3b637');g.addColorStop(1,'#ffe3b600');c.fillStyle=g;c.fillRect(x-185,0,370,330);
 }
 // Baked contact shadows under existing rear props, not new collision objects.
 const props=theme==='church'?[-10.5,-9.4,-8.3,8.3,9.4,10.5]:theme==='mall'?[-11,-8.6,-5,5,8.6,11]:theme==='basketball'?[-10.8,-7.8,7.8,10.8]:[-10,-6,7,10];
 for(const x of props){const px=(x+25)/50*2048;const g=c.createRadialGradient(px,92,0,px,92,65);g.addColorStop(0,'#111c263d');g.addColorStop(1,'#111c2600');c.save();c.translate(px,92);c.scale(1,.45);c.translate(-px,-92);c.fillStyle=g;c.fillRect(px-65,27,130,130);c.restore();}
 if(theme==='rooftop')for(const x of [-3,3]){const px=(x+25)/50*2048;c.strokeStyle='#273d343d';c.lineWidth=13;c.beginPath();c.ellipse(px,410,37,12,-.14,0,Math.PI*2);c.stroke();}
 if(theme==='basketball')for(let i=0;i<40;i++){c.strokeStyle='#d5dac31a';c.lineWidth=2;c.beginPath();c.ellipse(500+random()*1050,130+random()*250,5+random()*12,2,random()*3,0,Math.PI);c.stroke();}
}

/** A single textured apron adds layered masonry/timber wear below the play area. */
export function addArenaApron(root:THREE.Group,theme:ArenaTheme):void {
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=256;const c=canvas.getContext('2d')!;
 const indoor=theme==='church'||theme==='mall';
 for(let i=0;i<140;i++){
  const x=(i*487)%2048,y=(i*73)%256,w=8+i*19%90;
  c.fillStyle=i%3?'#07131d16':'#e9cfa917';c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y-3);c.lineTo(x+w*.7,y+4+i%11);c.lineTo(x-4,y+9);c.fill();
 }
 for(let i=0;i<60;i++){
  const x=i*173%2048,len=12+i*23%130;
  const g=c.createLinearGradient(0,0,0,len);g.addColorStop(0,indoor?'#16162226':'#17201e48');g.addColorStop(1,'#17201e00');c.fillStyle=g;c.fillRect(x,0,2+i%6,len);
  c.fillStyle='#ffe3ad33';c.fillRect(x+3,2,5+i%13,1);
 }
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(50,indoor?2.1:2.65),material);
 mesh.position.set(0,indoor?-1.3:-1.65,theme==='mall'?4.36:theme==='church'?4.19:4.045);mesh.userData.environmentIgnore=true;root.add(mesh);
}

/** Two soft pools in one draw, with a slow 3% variation rather than distracting flicker. */
export function addArenaLightPools(root:THREE.Group,theme:ArenaTheme):THREE.ShaderMaterial {
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  uniforms:{time:{value:0},tint:{value:new THREE.Color(theme==='basketball'?'#9bd8e7':'#f5cf95')},spacing:{value:theme==='church'?8:12.7}},
  vertexShader:'varying vec2 floorPoint;void main(){floorPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 floorPoint;uniform float time,spacing;uniform vec3 tint;void main(){vec2 p=floorPoint;float a=exp(-dot((p-vec2(-spacing,1.8))/vec2(3.1,2.1),(p-vec2(-spacing,1.8))/vec2(3.1,2.1)));float b=exp(-dot((p-vec2(spacing,1.8))/vec2(3.1,2.1),(p-vec2(spacing,1.8))/vec2(3.1,2.1)));float power=(a+b)*(.07+.002*sin(time*.65));gl_FragColor=vec4(tint,power);}'
 });
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(50,9),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.019;mesh.userData.environmentIgnore=true;root.add(mesh);return material;
}
