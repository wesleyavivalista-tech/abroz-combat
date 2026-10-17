import type {CharacterDefinition} from '../../types.js';
import {move} from '../common.js';
const axe=(id:string,patch:Parameters<typeof move>[1]={})=>move(id,{cancelRules:[],hitboxes:[{x:15,y:55,w:155,h:95}],...patch});
const ball=(id:string,kind:'straight'|'up'|'bounce')=>axe(id,{displayName:kind==='straight'?'Straight throw':kind==='up'?'Upward throw':'Bouncing ball',startupFrames:9,activeFrames:1,recoveryFrames:15,damage:36,hitboxes:[],returningProjectile:kind});
// Base-form basic phase boundaries run 10% faster, rounded to whole simulation frames.
const moves={
 chop:axe('chop',{displayName:'Axe sweep',startupFrames:7,activeFrames:6,recoveryFrames:16,damage:58,knockback:3,hitstun:27}),
 backhand:axe('backhand',{displayName:'Return swing',startupFrames:9,activeFrames:6,recoveryFrames:16,damage:66,knockback:4,hitstun:28}),
 cleave:axe('cleave',{displayName:'Finishing chop',startupFrames:12,activeFrames:6,recoveryFrames:20,damage:90,knockback:17}),
 heavy:axe('heavy',{displayName:'Heavy axe',state:'HeavyAttack',startupFrames:20,activeFrames:7,recoveryFrames:25,damage:130,knockback:20,launch:10,knockdown:true,priority:3}),
 toss:axe('toss',{displayName:'Sky axe',startupFrames:13,activeFrames:1,recoveryFrames:16,damage:75,hitboxes:[],returningProjectile:'axe'}),
 low:axe('low',{displayName:'Low axe sweep',state:'CrouchingAttack',level:'low',startupFrames:9,activeFrames:6,recoveryFrames:16,damage:65,hitboxes:[{x:5,y:5,w:145,h:50}]}),
 air:axe('air',{displayName:'Air chop',state:'AirAttack',startupFrames:8,activeFrames:9,recoveryFrames:17,damage:75}),
 gear:axe('gear',{displayName:'Heavy firefighter',state:'SpecialMove',startupFrames:15,activeFrames:1,recoveryFrames:15,damage:0,hitboxes:[],meterCost:25,armorFrames:300}),
 spin:axe('spin',{displayName:'Axe spin',state:'SpecialMove',startupFrames:15,activeFrames:120,recoveryFrames:20,damage:29,hitboxes:[],meterCost:25,mobile:true,durationClock:'simulation',periodicMelee:{interval:10,rangeX:175,rangeY:145,hitstun:12,push:1.5}}),
 juggle:axe('juggle',{displayName:'Juggling',state:'SpecialMove',startupFrames:20,activeFrames:1,recoveryFrames:15,damage:0,hitboxes:[],meterCost:100,weaponFrames:1560}),
 straight:ball('straight','straight'),straight2:ball('straight2','straight'),straight3:ball('straight3','straight'),up:ball('up','up'),bounce:ball('bounce','bounce'),
 finale:axe('finale',{displayName:'Five-ball finale',damage:20,hitboxes:[]}),
 water:axe('water',{displayName:'Firefighter water · aim ↑ / ↓',state:'SpecialMove',startupFrames:30,activeFrames:900,invulnerableWhileActive:true,recoveryFrames:24,damage:12,meterCost:100,meterGain:0,hitboxes:[],durationClock:'simulation',beam:{originProfile:"hose",clipToArena:true,targetProfile:"lower-stance",width:38,originX:110,originY:100,interval:6,steerable:true,fullCircle:true,continuous:true,push:5}}),
};
export const character:CharacterDefinition={id:'roms',armorDamageTaken:.6,modeDirectInputs:true,returningCapacity:4,
 returningPaths:{
  axe:{motion:'vertical',weapon:true,speed:0,verticalSpeed:23,gravity:.8,radius:28,hitInterval:18,life:900},
  straight:{motion:'straight',speed:18,verticalSpeed:0,gravity:0,radius:17,hitInterval:24,life:900},
  up:{motion:'vertical',speed:0,verticalSpeed:23,gravity:.8,radius:17,hitInterval:24,life:900},
  bounce:{motion:'bounce',exclusive:true,speed:5,verticalSpeed:27,gravity:.9,radius:17,hitInterval:24,life:900},
  finale:{motion:'bounce',finale:true,speed:0,verticalSpeed:0,gravity:.9,radius:17,hitInterval:24,life:300}
 },modeFinale:{move:'finale',path:'finale',duration:300,velocities:[[13,22],[-15,27],[18,18],[-11,30],[9,24]]},displayName:'ROMS',description:'Axe & water · 1.81 m',color:'#d74b3e',skins:[{id:'original',name:'Firefighter'},{id:'hoodie',name:'Off duty'}],stats:{maxHealth: 1450,walkSpeed:5,backwardSpeed:4,jumpVelocity:21,gravity:1,weight:105},moves,
 basicAttacks:{chain:['chop','backhand','cleave'],heavy:'heavy',kick:'toss',crouch:'low',air:'air'},
 weaponAttacks:{chain:['straight','straight2','straight3'],heavy:'up',kick:'bounce',crouch:'bounce',air:'up'},weaponExpiryMove:'finale',weaponModifiers:{speed:1,damageTaken:1,bodyScale:1,basicsOnly:true,label:'JUGGLING'},
 specialButtons:['gear','spin'],superButtons:['juggle','water'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite',duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{portrait:'/art/roms/portrait-1.png',atlas:'/art/roms/movement.png'},states:{}};
