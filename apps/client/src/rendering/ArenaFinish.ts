import * as THREE from 'three';

type Theme = 'church' | 'mall' | 'basketball' | 'rooftop';

/** Painted at world scale: broad material variation survives the gameplay camera. */
export function arenaFloorMap(theme: Theme): THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;
  const c=canvas.getContext('2d')!;
  let seed=813;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const palettes={church:['#a58b65','#b29a76','#9f886a','#bba17c'],mall:['#9e9690','#a9a298','#b4aba0','#99918d'],basketball:['#286e76','#30777d','#236970','#367b80'],rooftop:['#72746d','#7d7d72','#686e69','#828075']};
  const palette=palettes[theme];c.fillStyle=palette[0];c.fillRect(0,0,2048,512);
  const rows=theme==='church'?28:theme==='mall'?10:4;
  const columns=theme==='church'?32:theme==='mall'?40:20;
  const w=2048/columns,h=512/rows;
  for(let row=0;row<rows;row++)for(let col=-1;col<=columns;col++){
    const x=(col+(row%2)*.5)*w,y=row*h;
    c.fillStyle=palette[Math.floor(rand()*palette.length)];c.fillRect(x,y,w,h);
    if(theme!=='basketball'){
      c.strokeStyle=theme==='church'?'#362d244d':'#20292e33';c.lineWidth=theme==='mall'?1.5:2;c.strokeRect(x,y,w,h);
      c.fillStyle='#fbe7ba20';c.fillRect(x+2,y+2,w-4,1);
    }
    for(let mark=0;mark<12;mark++){
      const px=x+rand()*w,py=y+rand()*h,length=12+rand()*w*.6;
      c.strokeStyle=mark%3?'#171e2112':'#f6e8cb22';c.lineWidth=theme==='church'?1:2;
      c.beginPath();c.moveTo(px,py);c.lineTo(px+length*.4,py+(rand()-.5)*4);c.lineTo(px+length,py+2);c.stroke();
    }
    if(theme==='mall'&&(row+col)%4===0){
      c.strokeStyle='#4e4b541c';c.lineWidth=2;c.beginPath();c.moveTo(x,y+h*.1);c.lineTo(x+w*.35,y+h*.45);c.lineTo(x+w*.7,y+h*.5);c.lineTo(x+w,y+h);c.stroke();
    }
  }
  // Large angular brush patches, rather than screen-space grain or repeated stamps.
  for(let i=0;i<360;i++){
    const x=rand()*2048,y=rand()*512,s=12+rand()*80;
    c.fillStyle=i%2?'#f5ddb318':'#19273118';c.beginPath();c.moveTo(x,y);c.lineTo(x+s,y-3);c.lineTo(x+s*.65,y+8+rand()*12);c.lineTo(x-8,y+5);c.fill();
  }
  if(theme==='rooftop'){
    for(let i=0;i<24;i++){
      const x=rand()*2048,y=rand()*512;c.strokeStyle='#292f2b88';c.lineWidth=1.5;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+14,y+4);c.lineTo(x+23,y+19);c.lineTo(x+45,y+23);c.stroke();
    }
    for(let i=0;i<12;i++){c.fillStyle='#303b3440';c.fillRect(rand()*2048,rand()*512,30+rand()*60,10+rand()*18);}
  }
  // Contact dirt belongs at the perimeter; the central fighting lane stays quiet.
  for(const top of [true,false]){
    const g=c.createLinearGradient(0,top?0:512,0,top?80:432);g.addColorStop(0,'#151e294d');g.addColorStop(1,'#151e2900');c.fillStyle=g;c.fillRect(0,top?0:432,2048,80);
  }
  // Soft, baked light pools add atmosphere without extra lights or animation work.
  for(const x of [560,1488]){
    const glow=c.createRadialGradient(x,110,8,x,110,250);
    glow.addColorStop(0,theme==='basketball'?'#91e1e124':'#ffe1a32b');glow.addColorStop(1,'#ffe1a300');
    c.fillStyle=glow;c.fillRect(x-250,0,500,370);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

/** One thin painted fascia per deck. Its top never crosses the authored surface. */
export function addDeckFinish(root:THREE.Group,x:number,y:number,width:number,theme:Theme,index=0):void {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=96;
  const c=canvas.getContext('2d')!;
  const colors={church:['#8a7051','#d0b78c'],mall:['#443643','#c8a46b'],basketball:['#244957','#df894f'],rooftop:['#58605d','#c3b58b']};
  const [base,edge]=colors[theme];c.fillStyle=base;c.fillRect(0,0,1024,96);
  const grad=c.createLinearGradient(0,0,0,96);grad.addColorStop(0,'#ffffff12');grad.addColorStop(.4,'#ffffff00');grad.addColorStop(1,'#080f20a0');c.fillStyle=grad;c.fillRect(0,0,1024,96);
  for(let i=0;i<85;i++){
    const px=(i*137)%1024,py=12+(i*23)%70;c.fillStyle=i%3?'#0b172633':'#e9d5a82b';
    c.fillRect(px,py,8+(i*31)%65,theme==='church'?1:2);
  }
  c.fillStyle=edge;c.fillRect(0,2,1024,5);
  for(let i=0;i<25;i++){c.fillStyle=base;c.fillRect((i*173)%1024,2,3+i%9,2+i%4);}
  // Recessed panel seams, rivets and end guards convey construction at low cost.
  for(let px=64;px<1024;px+=128){
    c.fillStyle='#101c2b77';c.fillRect(px,12,2,70);c.fillStyle='#f0dfbe66';c.fillRect(px+3,12,1,65);
    for(const py of [18, 70]){c.fillStyle='#101b2a';c.beginPath();c.arc(px-10,py,3,0,Math.PI*2);c.fill();c.fillStyle=edge;c.fillRect(px-11,py-2,2,1);}
  }
  if(theme!=='church'){
    c.fillStyle='#172333';c.fillRect(456,22,112,49);c.strokeStyle=edge;c.lineWidth=2;c.strokeRect(456,22,112,49);
    c.fillStyle=edge;c.font='bold 28px monospace';c.textAlign='center';c.fillText(`${theme==='mall'?'M':theme==='basketball'?'C':'R'} / ${index+1}`,512,56);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width-.08,.27),new THREE.MeshStandardMaterial({map,roughness:theme==='mall'?.64:.9}));
  mesh.position.set(x,y-.19,theme==='church'?.855:.815);mesh.receiveShadow=true;root.add(mesh);
}


