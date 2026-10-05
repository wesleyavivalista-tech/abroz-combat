import * as THREE from 'three';
/** Shared source textures live until application teardown; fighter visuals own their clones. */
const textures=new Map<string,Promise<THREE.Texture>>();
export function loadTexture(url:string):Promise<THREE.Texture>{
 let pending=textures.get(url);
 if(!pending){
  pending=new THREE.TextureLoader().loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;}).catch(error=>{if(textures.get(url)===pending)textures.delete(url);throw error;});
  textures.set(url,pending);
 }
 return pending;
}
export function disposeTextureCache():void{
 for(const pending of textures.values())void pending.then(t=>t.dispose(),()=>{});
 textures.clear();
}
