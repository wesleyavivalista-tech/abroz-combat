import { Button, type CharacterDefinition } from '../../types.js';
import { move, normals } from '../common.js';
const moves = {
 crouch:{...normals().crouch,cancelRules:[]}, air:normals().air,
 light: move('light', {displayName:'Left punch',knockback:3,cancelRules:[]}),
 chain2: move('chain2', {displayName:'Right punch',startupFrames:6,activeFrames:4,recoveryFrames:14,damage:58,knockback:4,hitstun:24,cancelRules:[]}),
 chain3: move('chain3', {displayName:'Combo kick',startupFrames:8,activeFrames:5,recoveryFrames:20,damage:82,knockback:15,hitboxes:[{x:20,y:45,w:125,h:50}],cancelRules:[]}),
 vanish: move('vanish', {displayName:'Into the shadows',state:'SpecialMove',startupFrames:5,damage:0,hitboxes:[],cancelRules:[],holdInvisible:Button.Medium}),
 heavy: move('heavy', {displayName:'Heavy kick',state:'HeavyAttack',startupFrames:14,activeFrames:5,recoveryFrames:23,damage:120,knockback:17,launch:12,knockdown:true,priority:3,hitboxes:[{x:20,y:55,w:140,h:65}],cancelRules:[]}),
 pool: move('pool', {displayName:'Bloody ass',state:'SpecialMove',startupFrames:20,activeFrames:1,recoveryFrames:20,damage:0,meterCost:25,hitboxes:[],cancelRules:[],bloodPoolFrames:600}),
 dart: move('dart', {displayName:'Indigena',state:'SpecialMove',startupFrames:15,activeFrames:1,recoveryFrames:22,damage:45,meterCost:25,hitboxes:[],cancelRules:[],projectile:{speed:18,lifetime:140,radius:9,visual:'poison',originX:125,originY:145},poisonFrames:240,poisonDamage:10}),
 flood: move('flood', {displayName:'Sea of ass blood',state:'SpecialMove',startupFrames:36,activeFrames:1,recoveryFrames:96,damage:0,meterCost:100,hitboxes:[],cancelRules:[],bloodFloodFrames:1800,ownerFloodSpeed:1.2}),
 master: move('master', {displayName:'Blood master',state:'SpecialMove',startupFrames:20,activeFrames:1,recoveryFrames:20,damage:0,meterCost:100,hitboxes:[],cancelRules:[],bloodMasterFrames:2280}),
};
export const character:CharacterDefinition = {
 id:'caio',displayName:'CAIO',description:'Shadows & blood · 1.75 m',color:'#36bbb3',
 skins:[{id:'original',name:'Teal & gold'},{id:'black',name:'Blackout'}],
 stats:{maxHealth: 1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:21,gravity:1,weight:100},
 maxAirJumps:2,dashMultiplier:2.5,
 moves,basicAttacks:{chain:['light','chain2','chain3'],heavy:'vanish',kick:'heavy',crouch:'crouch',air:'air'},
 specialButtons:['pool','dart'],superButtons:['flood','master'],specialMoves:[],
 animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite',duration:30}])),
 sounds:{hit:'impact'},effects:{hit:'light-hit'},assets:{portrait:'/art/caio/portrait-user-blue-v3.png',alternatePortrait:'/art/caio/portrait-user-black-v3.png',atlas:'/art/caio/atlas-1.png'},states:{},
};
