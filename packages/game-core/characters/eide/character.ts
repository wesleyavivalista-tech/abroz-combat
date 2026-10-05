import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const standing=['Idle','WalkForward','WalkBackward','Crouch','DashForward','DashBackward'];
const moves={
 jab:hit('jab',{displayName:'Lead punch',damage:48,knockback:3}),
 cross:hit('cross',{displayName:'Cross',damage:58,startupFrames:6,activeFrames:4,recoveryFrames:14,hitstun:24,knockback:4}),
 hook:hit('hook',{displayName:'Finishing hook',damage:82,startupFrames:8,activeFrames:5,recoveryFrames:20,knockback:15,hitboxes:[{x:20,y:65,w:115,h:60}]}),
 heavyKick:hit('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',damage:115,startupFrames:15,activeFrames:6,recoveryFrames:24,priority:3,launch:10,knockdown:true,hitboxes:[{x:20,y:45,w:140,h:90}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:100,startupFrames:12,activeFrames:5,recoveryFrames:22,priority:3,knockback:18,hitboxes:[{x:20,y:60,w:120,h:60}]}),
 low:hit('low',{displayName:'Low punch',state:'CrouchingAttack',level:'low',damage:60,hitboxes:[{x:20,y:5,w:110,h:45}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',damage:75,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 seller:hit('seller',{displayName:'Seller',state:'SpecialMove',damage:85,meterCost:25,startupFrames:24,activeFrames:1,recoveryFrames:25,knockback:19,hitboxes:[],eideAbility:'seller',projectile:{visual:'appliance',speed:12,lifetime:170,radius:38}}),
 bahia:hit('bahia',{displayName:'Casas Bahia',state:'SpecialMove',damage:170,meterCost:25,startupFrames:30,activeFrames:1,recoveryFrames:26,knockback:22,launch:7,knockdown:true,hitboxes:[],eideAbility:'bahia',projectile:{visual:'appliance',speed:9,lifetime:180,radius:38}}),
 love:hit('love',{displayName:'In love',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:36,activeFrames:1,recoveryFrames:18,hitboxes:[],eideAbility:'love'}),
 mutant:hit('mutant',{displayName:'Suco lover',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:90,activeFrames:1,recoveryFrames:18,hitboxes:[],weaponFrames:1200}),
 giantPunch:hit('giantPunch',{displayName:'Giant Punch',state:'HeavyAttack',damage:110,startupFrames:22,activeFrames:8,recoveryFrames:30,priority:4,knockback:28,launch:9,knockdown:true,hitboxes:[{x:20,y:100,w:230,h:150}]}),
 charge:hit('charge',{displayName:'Charge',state:'HeavyAttack',damage:95,startupFrames:16,activeFrames:36,recoveryFrames:28,priority:4,knockback:25,launch:10,knockdown:true,advance:22,piercing:true,hitboxes:[{x:-45,y:0,w:170,h:280}]}),
 flyingKick:hit('flyingKick',{displayName:'Flying Kick',state:'AirAttack',damage:120,startupFrames:18,activeFrames:30,recoveryFrames:28,priority:4,knockback:28,launch:12,knockdown:true,selfLaunch:14,advance:20,piercing:true,hitboxes:[{x:0,y:40,w:245,h:160}]}),
};
export const character:CharacterDefinition={id:'eide',displayName:'EIDE',description:'Appliances & ambition · 1.76 m',color:'#c79a65',skins:[{id:'original',name:'Navy work outfit'},{id:'gym',name:'Tan gym outfit'}],stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,basicAttacks:{chain:['jab','cross','hook'],heavy:'heavyKick',kick:'heavyPunch',crouch:'low',air:'air'},weaponAttacks:{chain:['giantPunch','giantPunch','giantPunch'],heavy:'charge',kick:'flyingKick',crouch:'giantPunch',air:'flyingKick'},weaponModifiers:{speed:.6,damage:1.8,damageTaken:1,bodyScale:2,basicsOnly:true,label:'MUTANT'},modeDirectInputs:true,specialButtons:['seller','bahia'],superButtons:['love','mutant'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{portrait:'/art/eide/portrait-user-work-v4.png',alternatePortrait:'/art/eide/portrait-user-gym-v4.png',atlas:'/art/eide/combat-1.png',alternateAtlas:'/art/eide/combat-2.png'},states:{}};
