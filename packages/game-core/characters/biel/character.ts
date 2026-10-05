import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const standing=['Idle','WalkForward','WalkBackward','Crouch','DashForward','DashBackward'];
const moves={
 jab:hit('jab',{displayName:'Lead punch',damage:48}),
 cross:hit('cross',{displayName:'Cross',damage:58,startupFrames:6,activeFrames:4,recoveryFrames:14,hitstun:24}),
 kick:hit('kick',{displayName:'Finishing kick',damage:82,startupFrames:8,activeFrames:5,recoveryFrames:20,knockback:15,hitboxes:[{x:20,y:40,w:125,h:65}]}),
 heavyKick:hit('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',damage:115,startupFrames:15,activeFrames:6,recoveryFrames:24,priority:3,launch:10,knockdown:true,hitboxes:[{x:20,y:45,w:140,h:90}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:100,startupFrames:12,activeFrames:5,recoveryFrames:22,priority:3,knockback:18,hitboxes:[{x:20,y:60,w:120,h:60}]}),
 low:hit('low',{displayName:'Low punch',state:'CrouchingAttack',level:'low',damage:60,hitboxes:[{x:20,y:5,w:110,h:45}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',damage:75,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 wine:hit('wine',{displayName:'Wine lover',state:'SpecialMove',damage:65,meterCost:25,startupFrames:18,activeFrames:1,recoveryFrames:22,hitboxes:[],slowFrames:120,projectile:{visual:'wine',speed:13,lifetime:120,radius:19}}),
 coins:hit('coins',{displayName:'Coin Rain',state:'SpecialMove',damage:8,meterGain:0,meterCost:25,startupFrames:28,activeFrames:1,recoveryFrames:22,hitboxes:[],financeAbility:'coins'}),
 loan:hit('loan',{displayName:'Selling Loan',state:'SpecialMove',damage:0,meterGain:0,meterCost:100,startupFrames:25,activeFrames:1,recoveryFrames:15,hitboxes:[],financeAbility:'stamp-mode'}),
 stamp:hit('stamp',{displayName:'LOAN stamp',state:'HeavyAttack',damage:0,meterGain:0,startupFrames:14,activeFrames:6,recoveryFrames:24,hitstun:120,fixedStun:true,knockback:0,hitboxes:[{x:15,y:30,w:130,h:115}],loanStamp:true}),
 angel:hit('angel',{displayName:'MMORPG addicted',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:150,activeFrames:1,recoveryFrames:12,hitboxes:[],financeAbility:'angel'}),
 feathers:hit('feathers',{displayName:'Razor Feathers',state:'AirAttack',damage:22,meterGain:0,startupFrames:10,activeFrames:1,recoveryFrames:20,hitboxes:[],financeAbility:'feathers'}),
 dive:hit('dive',{displayName:'Diving Sword Strike',state:'AirAttack',damage:140,startupFrames:10,activeFrames:45,recoveryFrames:22,priority:3,knockback:18,launch:8,knockdown:true,hitboxes:[{x:-35,y:-20,w:170,h:145}],financeAbility:'dive'}),
 divine:hit('divine',{displayName:'Divine Energy Beam',state:'AirAttack',damage:12,meterGain:0,startupFrames:24,activeFrames:1500,recoveryFrames:16,hitboxes:[],beam:{originX:90,originY:600,width:70,interval:8,downward:true,continuous:true,clipToArena:true,holdButton:64}}),
};
export const character:CharacterDefinition={id:'biel',displayName:'BIEL',description:'Wine & loans · 1.76 m',color:'#c7b56d',skins:[{id:'original',name:'Gray suit'},{id:'casual',name:'Gray tee'}],stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,basicAttacks:{chain:['jab','cross','kick'],heavy:'heavyKick',kick:'heavyPunch',crouch:'low',air:'air'},specialButtons:['wine','coins'],superButtons:['loan','angel'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{portrait:'/art/biel/portrait-1.png',alternatePortrait:'/art/biel/portrait-2.png',atlas:'/art/biel/combat-1.png',alternateAtlas:'/art/biel/combat-2.png'},states:{},financeMoves:{stamp:'stamp',feathers:'feathers',dive:'dive',beam:'divine'}};
