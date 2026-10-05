import type {CharacterDefinition} from '../../types.js';
import {move} from '../common.js';
const strike=(id:string,patch:Parameters<typeof move>[1]={})=>move(id,{cancelRules:[],hitboxes:[{x:15,y:65,w:110,h:65}],...patch});
const moves={
 jab:strike('jab',{displayName:'Jab',startupFrames:8,activeFrames:4,recoveryFrames:17,damage:50,hitstun:25,knockback:3}),
 cross:strike('cross',{displayName:'Cross',startupFrames:10,activeFrames:5,recoveryFrames:18,damage:60,hitstun:27,knockback:4}),
 comboKick:strike('comboKick',{displayName:'Finishing kick',startupFrames:13,activeFrames:6,recoveryFrames:23,damage:85,knockback:16,hitboxes:[{x:15,y:45,w:155,h:75}]}),
 heavyKick:strike('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',startupFrames:23,activeFrames:7,recoveryFrames:27,damage:125,knockback:22,launch:8,knockdown:true,priority:3,hitboxes:[{x:15,y:45,w:175,h:85}]}),
 punch:strike('punch',{displayName:'Straight punch',startupFrames:12,activeFrames:5,recoveryFrames:20,damage:70,knockback:8}),
 low:strike('low',{displayName:'Low kick',state:'CrouchingAttack',level:'low',startupFrames:10,activeFrames:5,recoveryFrames:19,damage:60,hitboxes:[{x:5,y:0,w:140,h:55}]}),
 air:strike('air',{displayName:'Air kick',state:'AirAttack',startupFrames:9,activeFrames:9,recoveryFrames:19,damage:70,hitboxes:[{x:10,y:25,w:150,h:90}]}),
 seller:strike('seller',{displayName:'Seller',state:'SpecialMove',startupFrames:18,activeFrames:1,recoveryFrames:22,damage:65,meterCost:25,hitboxes:[],projectile:{speed:15,lifetime:180,radius:22,originX:95,originY:110,visual:'product',variants:10}}),
 wall:strike('wall',{displayName:'Wall',state:'SpecialMove',startupFrames:24,activeFrames:1,recoveryFrames:20,damage:0,meterCost:25,hitboxes:[],structure:{kind:'wall',width:50,height:250,healthRatio:.3,duration:300,offset:145}}),
 turret:strike('turret',{displayName:'Turret',state:'SpecialMove',startupFrames:36,activeFrames:1,recoveryFrames:24,damage:0,meterCost:100,hitboxes:[],structure:{kind:'turret',width:110,height:120,healthRatio:800/1400,duration:4800,offset:0,shotMove:'cannon',interval:72}}),
 cannon:strike('cannon',{displayName:'Turret cannonball',damage:36,hitstun:15,knockback:7,meterGain:0,hitboxes:[],projectile:{speed:16.2,lifetime:180,radius:16,visual:'cannonball'}}),
 home:strike('home',{displayName:'Your dream home · mark / build',state:'SpecialMove',startupFrames:30,activeFrames:1,recoveryFrames:22,damage:0,meterCost:100,hitboxes:[],reactivation:'build',structure:{kind:'house',width:520,height:560,healthRatio:1,duration:0,offset:300,collapseDamage:400,collapseStun:420}}),
 build:strike('build',{displayName:'Build the house',state:'SpecialMove',startupFrames:18,activeFrames:1,recoveryFrames:20,damage:0,meterCost:0,hitboxes:[],buildMarkedStructure:true}),
};
export const character:CharacterDefinition={id:'luizinho',displayName:'LUIZINHO',description:'Seller & builder · 1.70 m',color:'#4baccf',skins:[{id:'original',name:'White polo'},{id:'black',name:'Black dress shirt'}],stats:{maxHealth: 1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:21,gravity:1,weight:100},moves,basicAttacks:{chain:['jab','cross','comboKick'],heavy:'heavyKick',kick:'punch',crouch:'low',air:'air'},specialButtons:['seller','wall'],superButtons:['turret','home'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite',duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{portrait:'/art/luizinho/portrait-user-white-v6.png',alternatePortrait:'/art/luizinho/portrait-user-black-v6.png',atlas:'/art/luizinho/movement-1.png'},states:{}};
