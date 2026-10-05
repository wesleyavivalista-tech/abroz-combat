import * as THREE from 'three';

/** Small, deterministic painted material tiles, generated once per arena. */
export function arenaMaterial(base: string, kind: 'stone' | 'metal' | 'paint' | 'carpet', repeat = 1): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  let seed = 517;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  // Broad translucent brush facets keep the treatment close to the portrait art.
  for (let i = 0; i < 160; i++) {
    const x = random() * 256, y = random() * 256, size = 8 + random() * 48;
    ctx.fillStyle = i % 2 ? '#eee4ce18' : '#0817211b';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + size, y - 7);
    ctx.lineTo(x + size * .65, y + size * .35); ctx.lineTo(x - 4, y + size * .2); ctx.fill();
  }
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = i % 3 ? '#14202516' : '#fff0d529';
    ctx.fillRect(random() * 256, random() * 256, kind === 'metal' ? 3 : 1, 1);
  }
  if (kind === 'stone') {
    ctx.strokeStyle = '#14202535'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);
    for (let i = 0; i < 5; i++) {
      const x = random() * 256, y = random() * 256;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 5); ctx.lineTo(x + 14, y + 3); ctx.lineTo(x + 22, y + 17); ctx.stroke();
    }
  }
  if(kind==='carpet'){
    for(let y=0;y<256;y+=4)for(let x=0;x<256;x+=4){
      ctx.fillStyle=(x+y)%8?'#d5d9dc1c':'#101c2b35';
      ctx.fillRect(x,y,1,3);ctx.fillRect(x+1,y,2,1);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, 1);
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: kind === 'stone' ? .025 : .008,
    roughness: kind === 'metal' ? .75 : .96, metalness: kind === 'metal' ? .3 : 0 });
}

/** One draw call per box material, including all trim, grilles and fasteners. */
export function batchArenaBoxes(root: THREE.Group): void {
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...root.children]) {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.BoxGeometry) || Array.isArray(child.material)) continue;
    const group = groups.get(child.material) ?? []; group.push(child); groups.set(child.material, group);
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  for (const [material, meshes] of groups) {
    const batch = new THREE.InstancedMesh(unit, material, meshes.length);
    meshes.forEach((mesh, index) => {
      const dimensions = (mesh.geometry as THREE.BoxGeometry).parameters;
      mesh.scale.set(dimensions.width, dimensions.height, dimensions.depth); mesh.updateMatrix();
      batch.setMatrixAt(index, mesh.matrix); root.remove(mesh); mesh.geometry.dispose();
    });
    batch.castShadow = batch.receiveShadow = true; batch.computeBoundingSphere(); root.add(batch);
  }
}
