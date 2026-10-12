import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const standing=['Idle','WalkForward','WalkBackward','Crouch','DashForward','DashBackward'];
const moves={
 punch:hit('punch',{displayName:'Punch',damage:48,knockback:3}),
 comboKick:hit('comboKick',{displayName:'Combo kick',damage:58,startupFrames:6,activeFrames:4,recoveryFrames:14,knockback:4,hitboxes:[{x:20,y:45,w:105,h:50}]}),
 finishPunch:hit('finishPunch',{displayName:'Finishing punch',damage:82,startupFrames:8,activeFrames:5,recoveryFrames:20,knockback:14,hitboxes:[{x:20,y:60,w:115,h:60}]}),
 heavyKick:hit('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',damage:115,startupFrames:15,activeFrames:6,recoveryFrames:24,priority:3,launch:11,knockdown:true,hitboxes:[{x:20,y:45,w:140,h:90}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:100,startupFrames:12,activeFrames:5,recoveryFrames:22,priority:3,knockback:18,hitboxes:[{x:20,y:60,w:120,h:60}]}),
 low:hit('low',{displayName:'Low kick',state:'CrouchingAttack',level:'low',damage:60,hitboxes:[{x:20,y:5,w:110,h:35}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',damage:75,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 origami:hit('origami',{displayName:'Origami',state:'SpecialMove',allowedStates:standing,damage:100,meterGain:0,meterCost:25,startupFrames:48,activeFrames:1,recoveryFrames:18,hitboxes:[],origamiTrap:true,knockback:12,launch:6,priority:2}),
 cloud:hit('cloud',{displayName:'White Cloud',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:25,startupFrames:24,activeFrames:1,recoveryFrames:18,hitboxes:[],whiteCloudFrames:300}),
 ancestry:hit('ancestry',{displayName:'Ancestry',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:24,activeFrames:1,recoveryFrames:18,hitboxes:[],weaponFrames:1800}),
 bravinho:hit('bravinho',{displayName:'Bravinho',state:'SpecialMove',damage:0,meterGain:0,meterCost:100,startupFrames:0,activeFrames:1,recoveryFrames:30,hitboxes:[],angerFrames:2400}),
 slash:hit('slash',{displayName:'Sword slash',damage:58,knockback:3,startupFrames:6,activeFrames:4,recoveryFrames:14,hitboxes:[{x:15,y:55,w:145,h:65}]}),
 swordKick:hit('swordKick',{displayName:'Samurai kick',damage:65,knockback:4,startupFrames:7,activeFrames:4,recoveryFrames:15,hitboxes:[{x:20,y:45,w:110,h:55}]}),
 finishSlash:hit('finishSlash',{displayName:'Finishing slash',damage:95,knockback:14,startupFrames:9,activeFrames:5,recoveryFrames:20,hitboxes:[{x:15,y:45,w:165,h:80}]}),
 flash:hit('flash',{displayName:'Charged Flash Slash',state:'HeavyAttack',allowedStates:standing,damage:160,knockback:16,priority:3,chargeFrames:60,startupFrames:60,activeFrames:10,recoveryFrames:26,advance:75,piercing:true,flashDash:true,hitboxes:[{x:-30,y:0,w:100,h:155}]}),
 swordHeavy:hit('swordHeavy',{displayName:'Heavy sword attack',state:'HeavyAttack',damage:150,startupFrames:24,activeFrames:6,recoveryFrames:30,priority:3,knockback:24,launch:10,knockdown:true,hitboxes:[{x:15,y:20,w:170,h:135}]}),
 swordLow:hit('swordLow',{displayName:'Low sword slash',state:'CrouchingAttack',level:'low',damage:65,hitboxes:[{x:15,y:5,w:145,h:35}]}),
 swordAir:hit('swordAir',{displayName:'Air sword slash',state:'AirAttack',damage:85,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:20,w:140,h:80}]}),
};
export const character:CharacterDefinition={id:'fausto',displayName:'FAUSTO',description:'Paper & ancestry · 1.66 m',color:'#bcc9d7',skins:[{id:'original',name:'Black suit'},{id:'casual',name:'Oversized tee'}],stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,basicAttacks:{chain:['punch','comboKick','finishPunch'],heavy:'heavyKick',kick:'heavyPunch',crouch:'low',air:'air'},weaponAttacks:{chain:['slash','swordKick','finishSlash'],heavy:'flash',kick:'swordHeavy',crouch:'swordLow',air:'swordAir'},weaponModifiers:{speed:1.2,attackSpeed:1.2,damageTaken:.9,bodyScale:1,basicsOnly:false,label:'SAMURAI'},specialButtons:['origami','cloud'],superButtons:['ancestry','bravinho'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),sounds:{hit:'impact',special:'impact'},effects:{hit:'light-hit'},assets:{portrait:'/art/fausto/portrait-user-suit-v5.png',alternatePortrait:'/art/fausto/portrait-user-casual-v5.png',atlas:'/art/fausto/combat-1.png',alternateAtlas:'/art/fausto/combat-2.png'},states:{}};
