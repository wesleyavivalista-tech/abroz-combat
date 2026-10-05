import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const standing=['Idle','WalkForward','WalkBackward','Crouch','DashForward','DashBackward'];
const moves={
 jab:hit('jab',{displayName:'Punch',damage:48,knockback:3}),
 cross:hit('cross',{displayName:'Cross',damage:58,startupFrames:6,activeFrames:4,recoveryFrames:14,knockback:4,hitboxes:[{x:20,y:65,w:105,h:44}]}),
 comboKick:hit('comboKick',{displayName:'Combo kick',damage:82,startupFrames:8,activeFrames:5,recoveryFrames:20,knockback:14,hitboxes:[{x:20,y:45,w:125,h:50}]}),
 heavyKick:hit('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',damage:115,startupFrames:15,activeFrames:6,recoveryFrames:24,priority:3,launch:11,knockdown:true,hitboxes:[{x:20,y:45,w:140,h:90}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:100,startupFrames:12,activeFrames:5,recoveryFrames:22,priority:3,knockback:18,hitboxes:[{x:20,y:60,w:120,h:60}]}),
 low:hit('low',{displayName:'Low kick',state:'CrouchingAttack',level:'low',damage:60,hitboxes:[{x:20,y:5,w:110,h:35}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',damage:75,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 coolMuscles:hit('coolMuscles',{displayName:'Cool Muscles',state:'SpecialMove',allowedStates:standing,startupFrames:0,activeFrames:1,recoveryFrames:0,damage:0,meterCost:1,meterGain:0,hitboxes:[]}),
 investida:hit('investida',{displayName:'Investida',state:'SpecialMove',allowedStates:standing,meterCost:25,startupFrames:14,activeFrames:1,recoveryFrames:20,damage:110,priority:3,knockback:18,launch:12,knockdown:true,advance:18,arenaRoll:true,piercing:true,hitboxes:[{x:0,y:30,w:100,h:115}]}),
 gymBro:hit('gymBro',{displayName:'Gym Bro',state:'SpecialMove',meterCost:100,startupFrames:18,activeFrames:1,recoveryFrames:24,damage:0,meterGain:0,hitboxes:[]}),
 perfection:hit('perfection',{displayName:'Body Perfections',state:'SpecialMove',allowedStates:standing,meterCost:100,startupFrames:240,activeFrames:1,recoveryFrames:12,damage:0,meterGain:0,hitboxes:[],weaponFrames:1200}),
};
export const character:CharacterDefinition={
 id:'jomp',muscleFighter:true,displayName:'JOMP',description:'Muscles & athletic power · 1.76 m',color:'#f3c27b',
 skins:[{id:'original',name:'Shirtless'},{id:'charcoal',name:'Open charcoal shirt'}],
 stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},
 moves,basicAttacks:{chain:['jab','cross','comboKick'],heavy:'heavyKick',kick:'heavyPunch',crouch:'low',air:'air'},
 weaponModifiers:{speed:1.6,damageTaken:.6,bodyScale:1,basicsOnly:false,label:'PERFECT MODE',damage:1.5,attackSpeed:1.6,dash:2.5,airJumps:2},
 specialButtons:['coolMuscles','investida'],superButtons:['gymBro','perfection'],specialMoves:[],
 animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),
 sounds:{hit:'impact',special:'impact'},effects:{hit:'light-hit'},
 assets:{portrait:'/art/jomp/portrait-user-shirtless-v8.png',alternatePortrait:'/art/jomp/portrait-user-charcoal-v8.png',atlas:'/art/jomp/combat-1-tocha-v2.png',alternateAtlas:'/art/jomp/combat-2-tocha-v2.png'},states:{},
};
