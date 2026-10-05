import type {CharacterDefinition,MoveDefinition} from '../../types.js';
import {move} from '../common.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const moves={
 jab:hit('jab',{displayName:'Punch',knockback:3}),
 comboKick:hit('comboKick',{displayName:'Combo kick',startupFrames:7,activeFrames:4,recoveryFrames:14,damage:58,knockback:4,hitstun:25,hitboxes:[{x:20,y:45,w:110,h:45}]}),
 guitarSwing:hit('guitarSwing',{displayName:'Guitar swing',startupFrames:9,activeFrames:5,recoveryFrames:20,damage:84,priority:2,knockback:15,hitboxes:[{x:15,y:50,w:140,h:70}]}),
 heavy:hit('heavy',{displayName:'Heavy guitar swing',state:'HeavyAttack',startupFrames:16,activeFrames:6,recoveryFrames:24,damage:125,priority:3,knockback:18,launch:12,knockdown:true,hitboxes:[{x:15,y:40,w:155,h:115}]}),
 kick:hit('kick',{displayName:'Kick',startupFrames:8,activeFrames:4,recoveryFrames:16,damage:65,hitboxes:[{x:20,y:40,w:115,h:45}]}),
 low:hit('low',{displayName:'Low kick',state:'CrouchingAttack',level:'low',damage:60,startupFrames:7,activeFrames:5,recoveryFrames:17,hitboxes:[{x:20,y:5,w:115,h:35}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',level:'high',startupFrames:7,activeFrames:9,recoveryFrames:14,damage:75,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 chord:hit('chord',{displayName:'Power Chord',state:'SpecialMove',meterCost:25,startupFrames:15,activeFrames:2,recoveryFrames:24,damage:90,knockback:18,priority:2,hitboxes:[],projectile:{speed:13,lifetime:39,radius:48,visual:'sound'}}),
 lowProfile:hit('lowProfile',{displayName:'Low-profile',state:'SpecialMove',meterCost:25,startupFrames:0,activeFrames:1,recoveryFrames:0,damage:0,meterGain:0,hitboxes:[],invisibilityFrames:240}),
 painKillers:hit('painKillers',{displayName:'Pain Killers',state:'SpecialMove',meterCost:100,startupFrames:24,activeFrames:1,recoveryFrames:20,damage:0,meterGain:0,hitboxes:[],summonClones:3}),
 guitarStar:hit('guitarStar',{displayName:'Guitar Star',state:'SpecialMove',meterCost:100,startupFrames:18,activeFrames:1,recoveryFrames:12,damage:0,meterGain:0,hitboxes:[],weaponFrames:1200}),
 starWave:hit('starWave',{displayName:'Charged soundwave',state:'HeavyAttack',startupFrames:60,activeFrames:1,recoveryFrames:30,chargeFrames:60,damage:180,priority:3,knockback:24,launch:8,knockdown:true,hitboxes:[],projectile:{speed:18,lifetime:90,radius:65,visual:'sound'}}),
 pkJab:hit('pkJab',{displayName:'Pain Killer jab',startupFrames:4,activeFrames:3,recoveryFrames:6,damage:18,knockback:1,meterGain:0,hitstun:12}),
 pkCross:hit('pkCross',{displayName:'Pain Killer cross',startupFrames:4,activeFrames:3,recoveryFrames:6,damage:20,knockback:1,meterGain:0,hitstun:12}),
 pkFinish:hit('pkFinish',{displayName:'Pain Killer hook',startupFrames:5,activeFrames:3,recoveryFrames:12,damage:26,knockback:8,meterGain:0}),
 ball:hit('ball',{displayName:'Basketball throw',state:'HeavyAttack',startupFrames:16,activeFrames:1,recoveryFrames:40,damage:35,knockback:7,meterGain:0,hitboxes:[],projectile:{speed:9,lifetime:65,radius:18,visual:'basketball'}}),
};
export const character:CharacterDefinition={
 companionHealth:{ratio:.4,offset:-120},
 id:'dodo',musicFighter:true,companionStyle:'basketball',displayName:'DODO',description:'Guitar & sound · 1.82 m',color:'#e3bd69',
 skins:[{id:'original',name:'Leaf-print shirt'},{id:'black',name:'Black T-shirt'}],
 stats:{maxHealth: 1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,
 basicAttacks:{chain:['jab','comboKick','guitarSwing'],heavy:'heavy',kick:'kick',crouch:'low',air:'air'},
 weaponAttacks:{chain:['starWave','starWave','starWave'],heavy:'starWave',kick:'starWave',crouch:'starWave',air:'starWave'},
 weaponModifiers:{speed:1,damageTaken:1,bodyScale:1,basicsOnly:true,label:'GUITAR STAR'},
 specialButtons:['chord','lowProfile'],superButtons:['painKillers','guitarStar'],specialMoves:[{motion:'236',move:'chord'}],
 animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),
 sounds:{hit:'impact',special:'impact'},effects:{hit:'light-hit'},
 assets:{portrait:'/art/dodo/portrait-painted-leaf-v8.png',alternatePortrait:'/art/dodo/portrait-painted-black-v8.png',atlas:'/art/dodo/atlas-1.png',alternateAtlas:'/art/dodo/atlas-2.png'},states:{},
};
