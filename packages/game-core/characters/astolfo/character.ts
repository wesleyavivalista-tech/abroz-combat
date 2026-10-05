import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const moves={
 punch:hit('punch',{displayName:'Punch',damage:48,knockback:3}),
 comboKick:hit('comboKick',{displayName:'Combo kick',damage:58,startupFrames:6,activeFrames:4,recoveryFrames:14,knockback:4,hitboxes:[{x:20,y:45,w:105,h:50}]}),
 finishPunch:hit('finishPunch',{displayName:'Finishing punch',damage:82,startupFrames:8,activeFrames:5,recoveryFrames:20,knockback:14,hitboxes:[{x:20,y:60,w:115,h:60}]}),
 heavyKick:hit('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',damage:115,startupFrames:15,activeFrames:6,recoveryFrames:24,priority:3,launch:11,knockdown:true,hitboxes:[{x:20,y:45,w:140,h:90}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:100,startupFrames:12,activeFrames:5,recoveryFrames:22,priority:3,knockback:18,hitboxes:[{x:20,y:60,w:120,h:60}]}),
 low:hit('low',{displayName:'Low kick',state:'CrouchingAttack',level:'low',damage:60,hitboxes:[{x:20,y:5,w:110,h:35}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',damage:75,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 talking:hit('talking',{displayName:'Talking',state:'SpecialMove',damage:12,meterCost:2,meterGain:0,startupFrames:10,activeFrames:1000000,recoveryFrames:0,hitboxes:[],mobile:true,talking:true}),
 spider:hit('spider',{displayName:'Spider collection',state:'SpecialMove',damage:55,meterCost:25,meterGain:0,startupFrames:24,activeFrames:1,recoveryFrames:18,hitboxes:[],spider:true,poisonFrames:180,poisonDamage:10}),
 bipolar:hit('bipolar',{displayName:'Bipolar',state:'SpecialMove',damage:0,meterCost:100,meterGain:0,startupFrames:30,activeFrames:1,recoveryFrames:24,hitboxes:[],personalitySplit:true}),
 idea:hit('idea',{displayName:'A great idea',state:'SpecialMove',damage:16,meterCost:100,meterGain:0,startupFrames:18,activeFrames:1,recoveryFrames:18,hitboxes:[],talkAuraFrames:1080}),
};
export const character:CharacterDefinition={id:'astolfo',displayName:'ASTOLFO',description:'Talk & personalities · 1.60 m',color:'#91bfda',skins:[{id:'original',name:'Charcoal suit'},{id:'casual',name:'Pale blue shirt'}],stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,basicAttacks:{chain:['punch','comboKick','finishPunch'],heavy:'heavyKick',kick:'heavyPunch',crouch:'low',air:'air'},specialButtons:['talking','spider'],superButtons:['bipolar','idea'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),sounds:{hit:'impact',special:'impact'},effects:{hit:'light-hit'},assets:{portrait:'/art/astolfo/portrait-1.png',alternatePortrait:'/art/astolfo/portrait-2.png',atlas:'/art/astolfo/combat-1.png',alternateAtlas:'/art/astolfo/combat-2.png'},states:{}};
