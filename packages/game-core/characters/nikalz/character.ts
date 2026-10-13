import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const standing=['Idle','WalkForward','WalkBackward','Crouch','DashForward','DashBackward'];
const moves={
 jab:hit('jab',{displayName:'Jab',damage:45}),
 straight:hit('straight',{displayName:'Straight',damage:55,startupFrames:6,activeFrames:4,recoveryFrames:14}),
 cross:hit('cross',{displayName:'Cross',damage:45,startupFrames:7,activeFrames:4,recoveryFrames:16}),
 forehead:hit('forehead',{displayName:'Forehead finish',damage:65,startupFrames:9,activeFrames:5,recoveryFrames:20,knockback:16,hitboxes:[{x:15,y:80,w:110,h:55}]}),
 heavyHead:hit('heavyHead',{displayName:'Heavy forehead hit',state:'HeavyAttack',damage:130,startupFrames:17,activeFrames:6,recoveryFrames:25,knockback:25,launch:8,knockdown:true,hitboxes:[{x:10,y:65,w:130,h:65}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:105,startupFrames:14,activeFrames:5,recoveryFrames:22,knockback:18,hitboxes:[{x:20,y:65,w:125,h:55}]}),
 low:hit('low',{displayName:'Low punch',state:'CrouchingAttack',damage:55,level:'low',hitboxes:[{x:20,y:5,w:110,h:45}]}),
 air:hit('air',{displayName:'Air punch',state:'AirAttack',damage:65,activeFrames:9,hitboxes:[{x:10,y:20,w:100,h:70}]}),
 foreheadDive:hit('foreheadDive',{displayName:'Double-jump forehead dive',nikalzAbility:'dive',state:'AirAttack',damage:110,startupFrames:10,activeFrames:1,recoveryFrames:25,dive:{speed:26,drift:3},fixedStun:true,hitstun:120,knockback:5,hitboxes:[{x:-30,y:-20,w:90,h:100}]}),
 testada:hit('testada',{displayName:'Testada',state:'SpecialMove',allowedStates:standing,damage:125,meterCost:25,startupFrames:28,activeFrames:1,recoveryFrames:30,hitboxes:[],nikalzAbility:'shock'}),
 bees:hit('bees',{displayName:'Bees',state:'SpecialMove',damage:54,meterCost:25,startupFrames:22,activeFrames:1,recoveryFrames:20,hitboxes:[],nikalzAbility:'bees'}),
 meteor:hit('meteor',{displayName:'Meteor Forehead',state:'SpecialMove',allowedStates:standing,damage:650,meterCost:100,startupFrames:24,activeFrames:1,recoveryFrames:40,hitboxes:[],nikalzAbility:'meteor'}),
 beeHouse:hit('beeHouse',{displayName:'Bee house',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:30,activeFrames:1,recoveryFrames:20,hitboxes:[],nikalzAbility:'boxes'}),
 placeBox:hit('placeBox',{displayName:'Place bee box',state:'LightAttack',allowedStates:standing,damage:0,meterGain:0,startupFrames:12,activeFrames:1,recoveryFrames:16,hitboxes:[],nikalzAbility:'place',structure:{kind:'bee-box',width:62,height:92,healthRatio:550/1400,duration:0,offset:0,interval:240}}),
};
export const character:CharacterDefinition={id:'nikalz',displayName:'NIKALZ',description:'Forehead & bees · 1.78 m',color:'#d8b76a',skins:[{id:'original',name:'Beige sweater'},{id:'palmeiras',name:'Palmeiras jersey'}],stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,basicAttacks:{chain:['jab','straight','cross','forehead'],heavy:'heavyHead',kick:'heavyPunch',crouch:'low',air:'air',doubleJumpHeavy:'foreheadDive'},specialButtons:['testada','bees'],superButtons:['meteor','beeHouse'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{portrait:'/art/nikalz/portrait-1.png',alternatePortrait:'/art/nikalz/portrait-2.png',atlas:'/art/nikalz/combat-1.png',alternateAtlas:'/art/nikalz/combat-2.png'},states:{}};
