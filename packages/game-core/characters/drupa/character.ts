import {Button, type CharacterDefinition} from '../../types.js';
import {move} from '../common.js';
const moves={
 swing1:move('swing1',{displayName:'Left jab',cancelRules:[],startupFrames:9,activeFrames:5,recoveryFrames:17,damage:55,knockback:3,hitstun:25,hitboxes:[{x:10,y:60,w:125,h:55}]}),
 swing2:move('swing2',{displayName:'Right cross',cancelRules:[],startupFrames:10,activeFrames:5,recoveryFrames:19,damage:65,knockback:3,hitstun:27,hitboxes:[{x:10,y:60,w:135,h:55}]}),
 bellyFinish:move('bellyFinish',{displayName:'Belly finish',cancelRules:[],startupFrames:10,activeFrames:7,recoveryFrames:21,damage:95,knockback:18,advance:3,hitboxes:[{x:0,y:35,w:130,h:95}]}),
 belly:move('belly',{displayName:'Heavy belly bump',cancelRules:[],state:'HeavyAttack',startupFrames:20,activeFrames:8,recoveryFrames:27,damage:135,knockback:60.8,advance:4,priority:3,hitboxes:[{x:0,y:30,w:140,h:100}]}),
 wide:move('wide',{displayName:'Wide swing punch',cancelRules:[],startupFrames:13,activeFrames:6,recoveryFrames:21,damage:85,knockback:12,hitboxes:[{x:10,y:65,w:145,h:60}]}),
 low:move('low',{displayName:'Low swing',cancelRules:[],state:'CrouchingAttack',level:'low',startupFrames:10,activeFrames:5,recoveryFrames:18,damage:65,hitboxes:[{x:5,y:10,w:120,h:55}]}),
 air:move('air',{displayName:'Air kick',cancelRules:[],state:'AirAttack',startupFrames:8,activeFrames:12,recoveryFrames:18,damage:75,hitboxes:[{x:15,y:30,w:125,h:55}]}),
 bellyDive:move('bellyDive',{displayName:'Belly dive · 2s stun',cancelRules:[],state:'AirAttack',startupFrames:9,activeFrames:1,recoveryFrames:25,damage:140,hitstun:120,fixedStun:true,knockback:0,priority:3,dive:{speed:25,drift:5},hitboxes:[{x:-40,y:-25,w:185,h:90}]}),
 rolling:move('rolling',{meterCost:25, displayName:'Rolling',cancelRules:[],state:'SpecialMove',startupFrames:18,activeFrames:1,recoveryFrames:28,damage:115,knockback:20,priority:2,piercing:true,advance:14,arenaRoll:true,hitboxes:[{x:-40,y:0,w:130,h:95}]}),
 bald:move('bald',{meterCost:25, displayName:'Bald head',cancelRules:[],state:'SpecialMove',startupFrames:30,activeFrames:12,recoveryFrames:28,damage:100,hitboxes:[],beam:{width:30,originY:165,interval:12}}),
 budaBeam:move('budaBeam',{displayName:'White Buda Beam · aim ↑ / ↓',cancelRules:[],state:'SpecialMove',startupFrames:40,activeFrames:780,recoveryFrames:24,damage:18,meterCost:100,meterGain:0,hitboxes:[],beam:{initialAim:-12,width:55,originY:80,interval:12,steerable:true,float:100,continuous:true}}),
 buda:move('buda',{displayName:'White Buda Transformation',cancelRules:[],state:'SpecialMove',startupFrames:36,activeFrames:1,recoveryFrames:24,damage:0,meterCost:100,meterGain:0,hitboxes:[],weaponFrames:1560}),
 budaSwing1:move('budaSwing1',{displayName:'White Buda swing',cancelRules:[],startupFrames:14,activeFrames:7,recoveryFrames:23,damage:140,knockback:5,hitstun:31,hitboxes:[{x:10,y:310,w:255,h:115}]}),
 budaSwing2:move('budaSwing2',{displayName:'White Buda return swing',cancelRules:[],startupFrames:16,activeFrames:7,recoveryFrames:24,damage:161,knockback:6,hitstun:33,hitboxes:[{x:10,y:310,w:270,h:115}]}),
 budaFinish:move('budaFinish',{displayName:'White Buda finishing swing',cancelRules:[],startupFrames:20,activeFrames:8,recoveryFrames:30,damage:217,knockback:25,priority:3,hitboxes:[{x:10,y:295,w:280,h:130}]}),
 budaForward:move('budaForward',{displayName:'Heaven light · hold to channel',cancelRules:[],startupFrames:60,activeFrames:1560,recoveryFrames:22,damage:34,hitboxes:[],beam:{initialAim:-18,width:300,originY:900,originX:330,interval:12,downward:true,continuous:true,holdButton:Button.Medium}}),
 budaSky:move('budaSky',{displayName:'White Buda low kick',cancelRules:[],level:'low',startupFrames:12,activeFrames:8,recoveryFrames:18,damage:196,knockback:20,hitboxes:[{x:15,y:15,w:285,h:95}]}),
};
export const character:CharacterDefinition={id:'drupa',displayName:'DRUPA',description:'Belly & light · 1.75 m',color:'#965cce',skins:[{id:'original',name:'Varsity'},{id:'purple',name:'Heavyweight purple'}],stats:{maxHealth: 1600,walkSpeed:4,backwardSpeed:3,jumpVelocity:21,gravity:1,weight:130},moves,
 basicAttacks:{chain:['swing1','swing2','bellyFinish'],heavy:'belly',kick:'wide',crouch:'low',air:'air',doubleJumpHeavy:'bellyDive'},
 weaponAttacks:{chain:['budaSwing1','budaSwing2','budaFinish'],heavy:'budaForward',kick:'budaSky',crouch:'budaSwing1',air:'budaSwing1'},
 weaponModifiers:{speed:.8,damageTaken:.3,bodyScale:3,basicsOnly:true,label:'WHITE BUDA'},
 specialButtons:['rolling','bald'],superButtons:['budaBeam','buda'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite',duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{portrait:'/art/drupa/portrait-1-guard-v2.png',atlas:'/art/drupa/atlas-1.png'},states:{}};
