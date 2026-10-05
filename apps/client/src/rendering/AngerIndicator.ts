import * as THREE from 'three';

/** Smoothly ramps the visual effects without capping gameplay stacks. */
export const angerVisualIntensity=(stacks:number)=>1-Math.exp(-Math.max(0,stacks)/6);

/** A readable comic anger mark with stacking steam curls. Render-only. */
export class AngerIndicator {
 readonly root=new THREE.Group();
 private mark:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
 private steam:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
 private clock=0;private lastTime:number|undefined;private previousStacks=0;private burst=0;
 private textures:THREE.CanvasTexture[]=[];
 constructor(){
  const texture=(steam:boolean)=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
   const ctx=canvas.getContext('2d')!;ctx.lineCap='round';ctx.lineJoin='round';
   if(steam){
    ctx.strokeStyle='#fff1df';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(65,112);ctx.bezierCurveTo(12,84,110,65,65,40);ctx.bezierCurveTo(40,24,65,15,68,8);ctx.stroke();
   }else{
    // Four curved corners form the familiar comic "vein popping" symbol.
    for(let i=0;i<4;i++){
     ctx.save();ctx.translate(64,64);ctx.rotate(i*Math.PI/2);
     for(const [color,width] of [['#311019',23],['#fff3df',17],['#ff382e',11]] as const){
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(-43,-12);ctx.quadraticCurveTo(-13,-12,-12,-43);ctx.stroke();
     }
     ctx.restore();
    }
   }
   const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);return t;
  };
  const make=(map:THREE.Texture)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,depthTest:false,toneMapped:false}));m.renderOrder=12;this.root.add(m);return m;};
  this.mark=make(texture(false));const steamTexture=texture(true);
  for(let i=0;i<6;i++)this.steam.push(make(steamTexture));
  this.root.visible=false;
 }
 update(active:boolean,stacks:number,time:number,headHeight:number){
  const dt=this.lastTime===undefined?0:Math.max(0,Math.min(.1,time-this.lastTime));this.lastTime=time;
  this.root.visible=active;
  if(!active){this.clock=0;this.previousStacks=0;this.burst=0;return;}
  const intensity=angerVisualIntensity(stacks);
  if(stacks>this.previousStacks)this.burst=1;
  this.previousStacks=stacks;this.burst=Math.max(0,this.burst-dt*2.5);
  // Integrating speed avoids a phase jump each time another hit adds a stack.
  this.clock+=dt*(1+intensity*2.4);
  const beat=Math.sin(this.clock*7);
  this.root.position.set(0,headHeight+.35,.4);
  this.mark.scale.setScalar(.43+intensity*.22+beat*(.035+intensity*.045)+this.burst*.14);
  this.mark.rotation.z=Math.sin(this.clock*11)*(.06+intensity*.12);
  this.mark.position.y=Math.sin(this.clock*3)*.035;
  this.steam.forEach((m,i)=>{
   m.visible=i<Math.min(6,2+Math.ceil(Math.max(0,stacks)/2));
   const phase=(this.clock*.9+i/6)%1;
   m.position.set((i%2?1:-1)*(.3+Math.floor(i/2)*.09+phase*(.08+intensity*.12)),-.16+phase*(.36+intensity*.32),0);
   m.scale.set(.16+phase*.08+intensity*.1,.28+phase*.12+intensity*.18,1);
   m.material.opacity=Math.sin(phase*Math.PI)*(.55+intensity*.4);
  });
 }
 dispose(){for(const m of [this.mark,...this.steam]){m.geometry.dispose();m.material.dispose();}this.textures.forEach(t=>t.dispose());this.root.clear();}
}
