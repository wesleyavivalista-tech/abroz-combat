import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DashVisual,dashVariant} from '../apps/client/src/rendering/DashVisual.js';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';

test('dedicated dashes cover skins, summons and transformed Fausto without overriding attacks',()=>{
 for(const [id,skins] of [['fausto',['original','casual']],['napa',['original','gym','cookie-monster']],['dodo',['pain-killer-0','pain-killer-1','pain-killer-2']]] as const){
  const f=createFighter(id,1000,1);
  for(const skin of skins){for(const state of ['DashForward','DashBackward'] as const){f.state=state;assert.equal(dashVariant(id,skin,f)?.pose,state==='DashForward'?1:2);}
   f.move='air';assert.equal(dashVariant(id,skin,f),undefined);f.move=null;
  }
 }
 const f=createFighter('fausto',0,1);f.state='DashForward';f.weaponUntil=100;f.angerUntil=100;
 assert.equal(dashVariant('fausto','casual',f)?.row,2);
 f.state='Fall';assert.equal(dashVariant('fausto','original',f),undefined);
});
test('dash restores body on interruption, preserves effects and shares texture lifetime',()=>{
 const root=new THREE.Group(),body=new THREE.Group(),effect=new THREE.Group();root.add(body,effect);
 let disposed=false,textureDisposed=false;
 const texture=new THREE.CanvasTexture(undefined);texture.addEventListener('dispose',()=>{textureDisposed=true;});
 const frame={texture,width:100,height:130,pivot:50,referenceHeight:176};
 const visual=new DashVisual({root,fallBodies:[body],update(){},dispose(){disposed=true;}},'napa','original',new Map([['napa',[frame,frame,frame]]]));
 const f=createFighter('napa',0,1);f.state='DashForward';visual.update(f,0);
 assert.equal(body.visible,false);assert.equal(effect.visible,true);assert.equal(root.getObjectByName('dedicated-dash')?.visible,true);
 for(const state of ['Idle','Jump','Fall','HitStun','KO'] as const){f.state=state;visual.update(f,0);assert.equal(body.visible,true);assert.equal(root.getObjectByName('dedicated-dash')?.visible,false);}
 visual.dispose();assert.equal(disposed,true);assert.equal(textureDisposed,false);
});

test('Dodo normal skins keep the animated stride instead of a static dash overlay',()=>{
 const f=createFighter('dodo',1000,1);
 for(const skin of ['original','black'])for(const state of ['DashForward','DashBackward'] as const){f.state=state;assert.equal(dashVariant('dodo',skin,f),undefined);}
});
