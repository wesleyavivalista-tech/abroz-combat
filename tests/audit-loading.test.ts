import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadFighterSprites,registerSkinLoader,disposeFighterSprites} from '../apps/client/src/rendering/VisualRegistry.js';
import {loadTexture} from '../apps/client/src/rendering/TextureCache.js';
test('unselected assets do not block a match; failed loads retry without recreating successful textures',async t=>{
 const calls:string[]=[];let fail=true;
 // This test exercises loading, not rasterization. Supply twelve opaque islands
 // so the shared descent decoder can run in the headless test environment.
 const previousDocument=globalThis.document;
 const pixels=new Uint8ClampedArray(72*24*4);
 for(const x0 of [2,14,26,38,50,62])for(const y0 of [2,14])for(let y=y0;y<y0+8;y++)for(let x=x0;x<x0+8;x++)pixels[(y*72+x)*4+3]=255;
 globalThis.document={createElement:()=>({width:72,height:24,getContext:()=>({drawImage(){},getImageData:()=>({data:pixels}),createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})} as unknown as Document;
 t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async(url:string)=>{
  calls.push(url);if(url.includes('/roms/')&&fail)throw new Error('Roms unavailable');
  return /fall-|air-attack|hair-grip/.test(url)?new THREE.Texture({width:72,height:24} as HTMLImageElement):new THREE.Texture();
 });
 try{
  await loadFighterSprites(['gut']);assert.ok(calls.length);assert.ok(calls.every(url=>!url.includes('/roms/')));
  const count=calls.length;await loadFighterSprites(['gut']);assert.equal(calls.length,count);
  let customAttempts=0;
  registerSkinLoader('gut','test',async()=>{if(++customAttempts===1)throw new Error('retry');});
  await assert.rejects(loadFighterSprites(['gut']),/retry/);await loadFighterSprites(['gut']);assert.equal(calls.length,count);
  await assert.rejects(loadTexture('/art/roms/test.png'),/unavailable/);fail=false;
  const a=await loadTexture('/art/roms/test.png');assert.equal(await loadTexture('/art/roms/test.png'),a);
  assert.equal(calls.filter(url=>url==='/art/roms/test.png').length,2);
 }finally{await disposeFighterSprites();globalThis.document=previousDocument;}
});
