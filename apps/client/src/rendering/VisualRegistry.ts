import {disposeZombieSprites} from './ZombieSpriteRenderer.js';
import {CrouchAttackVisual} from './CrouchAttackVisual.js';
import {AirAttackVisual,airAttackCatalog,loadAirAttackArt,disposeAirAttackArt} from './AirAttackVisual.js';
import {loadNikalz,disposeNikalz} from './NikalzRenderer.js';
import {loadEide,disposeEide} from './EideRenderer.js';
import {loadBiel,disposeBiel} from './BielRenderer.js';
import {disposeBackwardDashArt} from './BackwardDash.js';
import {MountedVisual,loadMountedArt,disposeMountedArt,mountedCatalog} from './MountedVisual.js';
import {loadJopa,disposeJopa} from './JopaRenderer.js';
import {DashVisual,loadDashArt,disposeDashArt} from './DashVisual.js';
import {FallVisual,loadFallArt,disposeFallArt} from './FallVisual.js';
import {loadAstolfo,disposeAstolfo} from './AstolfoRenderer.js';
import {loadFausto,disposeFausto} from './FaustoRenderer.js';
import {loadNapa,disposeNapa} from './NapaRenderer.js';
import {loadJomp,disposeJomp} from './JompRenderer.js';
import {loadDodo,disposeDodoAssets} from './DodoRenderer.js';
import {loadLuizinhoPresentation} from '../characters/luizinho/presentation.js';
import {disposeTextureCache} from './TextureCache.js';
import {disposeSpriteMasks} from './SpriteIsolation.js';
import {characters} from '../../../../packages/game-core/characters/registry.js';
import {loadTexture} from './TextureCache.js';
import {loadRomsPresentation} from '../characters/roms/presentation.js';
import {caioMasterData,caioMasterBoxingData} from './caioMasterData.js';
import {drupaPunchData} from './drupaPunchData.js';
import {drupaMotionData} from './drupaMotionData.js';
import {caioBoxingData} from './caioBoxingData.js';
import {CaioRenderer} from './CaioRenderer.js';
import {caioAtlases} from './CaioAtlas.js';
import {DrupaRenderer} from './DrupaRenderer.js';
import {drupaAtlases} from './DrupaAtlas.js';
import {walkAtlases,type WalkCharacter} from './WalkAtlas.js';
import {prepareWalkTextures} from './AuthoredWalk.js';
import { GutRenderer } from './GutRenderer.js';
import { prepareSpriteIsolation } from './SpriteIsolation.js';
import { expansionFrames } from './ExpansionAtlas.js';
import { BozoRenderer } from "./BozoRenderer.js";
import { TochaRenderer } from "./TochaRenderer.js";
import * as THREE from "three";

import type { CharacterDefinition } from "../../../../packages/game-core/types.js";
import { FighterRenderer, type FighterVisual } from "./FighterRenderer.js";
export type VisualFactory = (definition: CharacterDefinition) => FighterVisual;
const factories = new Map<string, VisualFactory>();
export function registerFighterVisual(
  id: string,
  factory: VisualFactory,
  skin = "original",
): void {
  factories.set(`${id}:${skin}`, factory);
}
export function createFighterVisual(
  definition: CharacterDefinition,
  skin = "original",
): FighterVisual {
  let visual:FighterVisual = (
    (factories.get(`${definition.id}:${skin}`) ?? factories.get(`${definition.id}:original`))?.(definition) ??
    new FighterRenderer(definition.color)
  );
  if(airAttackCatalog[definition.id]&&visual.fallBodies)visual=new AirAttackVisual(visual,definition.id,skin);
  if(['fausto','napa','dodo'].includes(definition.id)&&visual.fallBodies)visual=new DashVisual(visual,definition.id,skin);
  if(visual.fallBodies)visual=new FallVisual(visual,definition.id,skin);
  if(mountedCatalog.some(ids=>ids.includes(definition.id))&&definition.skins?.some(s=>s.id===skin))visual=new MountedVisual(visual,definition.id,skin);
  return new CrouchAttackVisual(visual);
}

const skinLoaders = new Map<string, () => Promise<void>>();
/** Register before match loading; the loader decodes assets and registers its factory. */
export function registerSkinLoader(characterId: string, skinId: string, loader: () => Promise<void>): void {
  skinLoaders.set(`${characterId}:${skinId}`, loader);
  loads.delete(characterId);
}
const loads=new Map<string,Promise<void>>();
export function loadFighterSprites(ids:readonly string[]=Object.keys(characters)):Promise<void>{
 const mounted=ids.includes('jopa')?Promise.all([...new Set(ids)].map(loadMountedArt)):Promise.resolve();
 return Promise.all([mounted,...[...new Set(ids)].map(id=>{
  let pending=loads.get(id);
  if(!pending){pending=loadCharacter(id).catch(error=>{if(loads.get(id)===pending)loads.delete(id);throw error;});loads.set(id,pending);}
  return pending;
 })]).then(()=>{});
}
async function loadCharacter(id:string):Promise<void>{
    await Promise.all([loadFallArt(id),loadDashArt(id),loadAirAttackArt(id)]);
    const walks={} as Record<WalkCharacter,THREE.Texture[]>;
    await Promise.all(((id==='tocha'?['tocha']:id==='bozo'?['bozo','clone']:id==='gut'?['gut','spear']:[]) as WalkCharacter[]).map(async kind=>{
      walks[kind]=await Promise.all(walkAtlases[kind].sources.map(async source=>{
        const t=await loadTexture(source.path);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;
      }));prepareWalkTextures(walks[kind],kind);
    }));
    if(id==='tocha'){
    const atlases = await Promise.all([1, 2].map(async n => {
      const t = await loadTexture(`/art/tocha/skin-${n}-atlas.png`);
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
    }));
    const fireAtlases = await Promise.all([1, 2].map(async n => {
      const t = await loadTexture(`/art/tocha/skin-${n}-fire-attacks.png`);
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
    }));
    const idleAtlas = await loadTexture("/art/tocha/idle-v1.png");
    idleAtlas.colorSpace = THREE.SRGBColorSpace;
    idleAtlas.magFilter = idleAtlas.minFilter = THREE.NearestFilter;
    idleAtlas.generateMipmaps = false;
    const [tochaMovement] = await Promise.all(["tocha/movement-v2"].map(async id => {
      const texture=await loadTexture(`/art/${id}.png`);
      texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
      return texture;
    }));
    const [tochaExpansion]=await Promise.all(['tocha/motion-expansion-v1'].map(async path=>{
      const t=await loadTexture('/art/'+path+'.png');t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;
    }));
    prepareSpriteIsolation(tochaExpansion,expansionFrames.tocha.frames);
    registerFighterVisual("tocha", def => new TochaRenderer(def, atlases, 0, fireAtlases, idleAtlas, tochaMovement, tochaExpansion,walks.tocha));
    registerFighterVisual("tocha", def => new TochaRenderer(def, atlases, 1, fireAtlases, idleAtlas, tochaMovement, tochaExpansion,walks.tocha), "shirtless");
    }
    if(id==='bozo'){
    const [bozoMovement,cloneMovement,bozoExpansion,cloneExpansion,bodyHair]=await Promise.all(['bozo/model-movement-v1','bozo/clone-movement-v2','bozo/model-expansion-v1','bozo/clone-expansion-v1','bozo/body-hair-long-v1'].map(id=>loadTexture(`/art/${id}.png`)));
    prepareSpriteIsolation(bozoExpansion,expansionFrames.bozo.frames);
    prepareSpriteIsolation(cloneExpansion,expansionFrames.clone.frames);
    const bozoAtlases = await Promise.all(["model-base-polo-v1", "model-base-basketball-v1", "clones"].map(async name => {
      const t = await loadTexture(`/art/bozo/${name}.png`);
      t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;
    }));
    registerFighterVisual("bozo", () => new BozoRenderer(bozoAtlases,0,false,bozoMovement,cloneMovement,undefined,bozoExpansion,cloneExpansion,walks.bozo,walks.clone,bodyHair));
    registerFighterVisual("bozo", () => new BozoRenderer(bozoAtlases,1,false,bozoMovement,cloneMovement,undefined,bozoExpansion,cloneExpansion,walks.bozo,walks.clone,bodyHair), "basketball");
    registerFighterVisual("bozo", () => new BozoRenderer(bozoAtlases,0,true,bozoMovement,cloneMovement,undefined,bozoExpansion,cloneExpansion,walks.bozo,walks.clone,bodyHair), "hair-clone");
    }
    if(id==='gut'){
    const gutExpansion=await loadTexture('/art/gut/motion-expansion-v1.png');
    prepareSpriteIsolation(gutExpansion,expansionFrames.gut.frames);
    const gutAtlases=await Promise.all(['atlas-1','atlas-2','guard-walk-meditation-v1','spear-bodies-v3','spear-weapon-v3'].map(async name=>{
      const t=await loadTexture(`/art/gut/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;
    }));
    registerFighterVisual('gut',()=>new GutRenderer(gutAtlases,0,gutExpansion,walks.gut,walks.spear));
    registerFighterVisual('gut',()=>new GutRenderer(gutAtlases,1,gutExpansion,walks.gut,walks.spear),'kung-fu');
    }
    if(id==='drupa'){
    const drupa=await Promise.all(['atlas-1','atlas-2','buda-complete-v4','combat-v2','dash-forward-v1','cross-v3','motion-v8','boxing-body-v9'].map(async name=>{
      const t=await loadTexture(`/art/drupa/${name}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
      prepareSpriteIsolation(t,name==='boxing-body-v9'?drupaPunchData.frames:name==='motion-v8'?drupaMotionData.frames:drupaAtlases[name as keyof typeof drupaAtlases].frames);return t;
    }));
    registerFighterVisual('drupa',()=>new DrupaRenderer(drupa,0));
    registerFighterVisual('drupa',()=>new DrupaRenderer(drupa,1),'purple');
    }
    if(id==='caio'){
    const caioBoxing=await loadTexture('/art/caio/boxing-v2.png');caioBoxing.colorSpace=THREE.SRGBColorSpace;caioBoxing.magFilter=caioBoxing.minFilter=THREE.NearestFilter;caioBoxing.generateMipmaps=false;prepareSpriteIsolation(caioBoxing,caioBoxingData.frames);
    const masterBoxing=await loadTexture('/art/caio/master-boxing.png');masterBoxing.colorSpace=THREE.SRGBColorSpace;masterBoxing.magFilter=masterBoxing.minFilter=THREE.NearestFilter;masterBoxing.generateMipmaps=false;prepareSpriteIsolation(masterBoxing,caioMasterBoxingData.frames);
    await Promise.all([0,1].map(async skin=>{
      const master=await loadTexture(`/art/caio/master-${skin+1}.png`);master.colorSpace=THREE.SRGBColorSpace;master.magFilter=master.minFilter=THREE.NearestFilter;master.generateMipmaps=false;prepareSpriteIsolation(master,caioMasterData[skin].frames);
      const t=await loadTexture(`/art/caio/atlas-${skin+1}.png`);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
      prepareSpriteIsolation(t,caioAtlases[skin].frames);registerFighterVisual('caio',()=>new CaioRenderer(t,skin,caioBoxing,master,masterBoxing),skin?'black':'original');
    }));
    }
    if(id==='astolfo')await loadAstolfo(registerFighterVisual);
    if(id==='fausto')await loadFausto(registerFighterVisual);
    if(id==='jopa')await loadJopa(registerFighterVisual);
    if(id==='nikalz')await loadNikalz(registerFighterVisual);
    if(id==='eide')await loadEide(registerFighterVisual);
    if(id==='biel')await loadBiel(registerFighterVisual);
    if(id==='napa')await loadNapa(registerFighterVisual);
    if(id==='jomp')await loadJomp(registerFighterVisual);
    if(id==='dodo')await loadDodo(registerFighterVisual);
    if(id==='luizinho')await loadLuizinhoPresentation(registerFighterVisual);
    if(id==='roms'){
    await loadRomsPresentation(registerFighterVisual);
    }
    await Promise.all([...skinLoaders].filter(([key])=>key.startsWith(id+':')).map(([,load])=>load()));
}

export async function disposeFighterSprites():Promise<void>{
 await Promise.allSettled([...loads.values()]);
 await disposeDodoAssets();
 await disposeJomp();
 disposeMountedArt();
 disposeJopa();disposeBiel();disposeEide();disposeNikalz();
 disposeNapa();
 disposeFausto();
 disposeAstolfo();
 disposeAirAttackArt();disposeFallArt();disposeDashArt();disposeBackwardDashArt();
 loads.clear();factories.clear();skinLoaders.clear();disposeSpriteMasks();disposeZombieSprites();disposeTextureCache();
}
