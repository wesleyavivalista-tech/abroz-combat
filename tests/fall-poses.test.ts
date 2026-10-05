import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FallVisual,fallVariant,fallCatalog} from '../apps/client/src/rendering/FallVisual.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import type {FighterVisual} from '../apps/client/src/rendering/FighterRenderer.js';
import {existsSync} from 'node:fs';

for(const [id,spec] of Object.entries(fallCatalog))test(`${id}: both skins have descent assets, attacks retain priority`,()=>{
 const f=createFighter(id,1000,1);f.state='Fall';
 for(const skin of ['original',spec.second]){
  const v=fallVariant(id,skin,f)!;assert.ok(v);assert.equal(v.row,skin==='original'?0:1);
  assert.ok(existsSync(`apps/client/public/art/${id}/fall-v1.png`));
  f.move='air';assert.equal(fallVariant(id,skin,f),undefined);f.move=null;
  f.state='AirHitStun';assert.equal(fallVariant(id,skin,f),undefined);f.state='Fall';
 }
});
test('fall transitions restore body visibility without hiding effects or disposing shared art',()=>{
 const root=new THREE.Group(),body=new THREE.Group(),effect=new THREE.Group(),inactive=new THREE.Group();inactive.visible=false;root.add(body,effect,inactive);
 let updates=0,disposed=false,textureDisposed=false;
 const base:FighterVisual={root,fallBodies:[body,inactive],update(){updates++;},dispose(){disposed=true;}};
 const texture=new THREE.CanvasTexture(undefined);texture.addEventListener('dispose',()=>{textureDisposed=true;});
 const frame={texture,width:100,height:160,pivot:50,referenceHeight:180};
 const visual=new FallVisual(base,'napa','original',new Map([['napa',[frame,frame,frame,frame]]]));
 const f=createFighter('napa',1000,1);f.state='Fall';visual.update(f,0);visual.update(f,.1);
 assert.equal(body.visible,false);assert.equal(effect.visible,true);assert.equal(root.getObjectByName('neutral-fall')?.visible,true);
 for(const state of ['Jump','Land','AirHitStun','KO'] as const){f.state=state;visual.update(f,.2);assert.equal(body.visible,true);assert.equal(inactive.visible,false);assert.equal(root.getObjectByName('neutral-fall')?.visible,false);}
 f.state='Fall';f.move='air';visual.update(f,.3);assert.equal(body.visible,true);
 assert.equal(updates,7);visual.dispose();assert.equal(disposed,true);assert.equal(textureDisposed,false);
});
test('transformed descent retains the correct form and scale',()=>{
 for(const id of ['fausto','gut','drupa']){const f=createFighter(id,0,1);f.state='Fall';f.weaponUntil=100;const v=fallVariant(id,'original',f)!;assert.equal(v.row,id==='fausto'?2:0);if(id==='gut')assert.equal(v.sheet,'gut-spear');if(id==='drupa')assert.equal(v.height,5.25);}
 for(const id of ['roms','bozo']){const f=createFighter(id,0,1);f.state='Fall';f.armorUntil=100;assert.equal(fallVariant(id,'original',f)?.row,2);}
 const f=createFighter('caio',0,1);f.state='Fall';f.bloodMasterUntil=100;assert.equal(fallVariant('caio','black',f)?.sheet,'caio-master-black');
});
