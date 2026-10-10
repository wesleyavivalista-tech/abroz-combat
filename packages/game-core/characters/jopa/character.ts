import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const standing=['Idle','WalkForward','WalkBackward','Crouch','DashForward','DashBackward'];
const moves={
 jab:hit('jab',{displayName:'Lead punch',damage:48}),
 comboKick:hit('comboKick',{displayName:'Combo kick',damage:60,startupFrames:7,hitboxes:[{x:20,y:40,w:125,h:65}]}),
 cross:hit('cross',{displayName:'Finishing cross',damage:82,startupFrames:8,knockback:15}),
 heavyKick:hit('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',damage:115,startupFrames:15,activeFrames:6,recoveryFrames:24,priority:3,launch:10,knockdown:true,hitboxes:[{x:20,y:45,w:140,h:90}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:100,startupFrames:12,activeFrames:5,recoveryFrames:22,priority:3,knockback:18,hitboxes:[{x:20,y:60,w:120,h:60}]}),
 low:hit('low',{displayName:'Low punch',state:'CrouchingAttack',level:'low',damage:60,hitboxes:[{x:20,y:5,w:110,h:45}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',damage:75,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 football:hit('football',{displayName:'Football',state:'SpecialMove',damage:52,meterCost:25,startupFrames:18,activeFrames:1,recoveryFrames:22,hitboxes:[],jopaAbility:'football'}),
 chess:hit('chess',{displayName:'Chess Master',state:'SpecialMove',damage:80,meterCost:25,startupFrames:20,activeFrames:1,recoveryFrames:24,hitboxes:[],hitstun:60,fixedStun:true,jopaAbility:'chess'}),
 tree:hit('tree',{displayName:'Crying Tree',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:60,activeFrames:1,recoveryFrames:20,hitboxes:[],jopaAbility:'tree'}),
 knight:hit('knight',{displayName:'Chess Knight',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:45,activeFrames:1,recoveryFrames:20,hitboxes:[],jopaAbility:'knight'}),
};
export const character:CharacterDefinition={id:'jopa',displayName:'JOPA',description:'Chess & football · 1.76 m',color:'#e6c34c',skins:[{id:'original',name:'Santos jersey'},{id:'casual',name:'White tee'}],stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,basicAttacks:{chain:['jab','comboKick','cross'],heavy:'heavyKick',kick:'heavyPunch',crouch:'low',air:'air'},specialButtons:['football','chess'],superButtons:['tree','knight'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{portrait:'/art/jopa/portrait-user-santos-v4.png',alternatePortrait:'/art/jopa/portrait-user-white-v4.png',atlas:'/art/jopa/combat-1.png',alternateAtlas:'/art/jopa/combat-2.png'},states:{}};
