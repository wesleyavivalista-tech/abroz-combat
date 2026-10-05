import { Button, type CharacterDefinition } from '../../types.js';
import { move } from '../common.js';
const moves={
 spearThrow:move('spearThrow',{displayName:'Final spear throw',cancelRules:[],state:'SpecialMove',startupFrames:0,activeFrames:1,recoveryFrames:18,damage:240,knockback:16,hitboxes:[],projectile:{speed:18,lifetime:180,radius:18,visual:'spear'}}),
 palm:move('palm',{displayName:'Palm strike',cancelRules:[],damage:45,knockback:3}),
 cross:move('cross',{displayName:'Cross punch',cancelRules:[],startupFrames:6,activeFrames:4,recoveryFrames:14,damage:60,knockback:4,hitstun:24}),
 finish:move('finish',{displayName:'Turning kick',cancelRules:[],startupFrames:9,activeFrames:5,recoveryFrames:22,damage:85,knockback:15,hitboxes:[{x:15,y:55,w:145,h:55}]}),
 axe:move('axe',{displayName:'Heavy axe kick',cancelRules:[],state:'HeavyAttack',startupFrames:22,activeFrames:7,recoveryFrames:27,damage:135,priority:3,knockdown:true,hitboxes:[{x:10,y:20,w:140,h:140}]}),
 swing:move('swing',{displayName:'Wide swing punch',cancelRules:[],startupFrames:12,activeFrames:6,recoveryFrames:20,damage:85,knockback:13,hitboxes:[{x:0,y:65,w:150,h:55}]}),
 crouch:move('crouch',{displayName:'Low sweep',cancelRules:[],state:'CrouchingAttack',level:'low',startupFrames:9,activeFrames:5,recoveryFrames:18,damage:65,hitboxes:[{x:15,y:5,w:130,h:35}]}),
 air:move('air',{displayName:'Air kick',cancelRules:[],state:'AirAttack',startupFrames:7,activeFrames:10,recoveryFrames:16,damage:75,hitboxes:[{x:5,y:35,w:130,h:60}]}),
 hug:move('hug',{meterCost:25, displayName:'Unwanted touching',cancelRules:[],state:'SpecialMove',startupFrames:15,activeFrames:18,recoveryFrames:30,advance:22,damage:25,knockback:0,grappleFrames:240,hitboxes:[{x:0,y:25,w:200,h:110}]}),
 meditation:move('meditation',{meterCost:25, displayName:'Meditation (hold)',cancelRules:[],state:'SpecialMove',startupFrames:0,activeFrames:1,recoveryFrames:0,damage:0,meterGain:0,hitboxes:[],channelHeal:{button:Button.Special2,interval:120,amount:85}}),
 immortal:move('immortal',{displayName:'Immortal',cancelRules:[],state:'SpecialMove',startupFrames:45,activeFrames:1,recoveryFrames:30,meterCost:100,meterGain:0,damage:0,hitboxes:[],extraLife:true}),
 panda:move('panda',{displayName:'Kung Fu Panda',cancelRules:[],state:'SpecialMove',startupFrames:24,activeFrames:1,recoveryFrames:18,meterCost:100,meterGain:0,damage:0,hitboxes:[],weaponFrames:1800}),
 thrust:move('thrust',{displayName:'Spear thrust',cancelRules:[],startupFrames:8,activeFrames:5,recoveryFrames:15,damage:90,knockback:3,hitstun:26,hitboxes:[{x:15,y:70,w:350,h:40}]}),
 sweep:move('sweep',{displayName:'Spear sweep',cancelRules:[],startupFrames:10,activeFrames:6,recoveryFrames:17,damage:110,knockback:4,hitstun:28,hitboxes:[{x:0,y:45,w:360,h:75}]}),
 spearFinish:move('spearFinish',{displayName:'Driving thrust',cancelRules:[],startupFrames:12,activeFrames:6,recoveryFrames:24,damage:140,knockback:22,hitboxes:[{x:10,y:50,w:390,h:70}]}),
 spearHeavy:move('spearHeavy',{displayName:'Rising spear',selfLaunch:14,cancelRules:[],startupFrames:24,activeFrames:7,recoveryFrames:30,damage:180,priority:3,knockdown:true,launch:20,hitboxes:[{x:0,y:90,w:90,h:80},{x:65,y:150,w:85,h:80},{x:130,y:190,w:85,h:80},{x:195,y:240,w:95,h:35}]}),
 spearSwing:move('spearSwing',{displayName:'Wide spear swing',cancelRules:[],startupFrames:14,activeFrames:7,recoveryFrames:24,damage:125,knockback:18,hitboxes:[{x:0,y:45,w:370,h:80}]}),
 spearLow:move('spearLow',{displayName:'Low spear sweep',cancelRules:[],state:'CrouchingAttack',level:'low',startupFrames:12,activeFrames:6,recoveryFrames:21,damage:105,hitboxes:[{x:5,y:5,w:340,h:40}]}),
 spearDive:move('spearDive',{displayName:'Diving spear',cancelRules:[],state:'AirAttack',startupFrames:7,activeFrames:1,recoveryFrames:24,damage:160,priority:3,knockdown:true,knockback:12,dive:{speed:28,drift:4},hitboxes:[{x:45,y:0,w:70,h:65},{x:100,y:-35,w:70,h:65},{x:155,y:-70,w:70,h:65},{x:210,y:-120,w:80,h:75}]}),
 spearAir:move('spearAir',{displayName:'Air spear thrust',cancelRules:[],state:'AirAttack',startupFrames:9,activeFrames:12,recoveryFrames:20,damage:110,hitboxes:[{x:10,y:30,w:340,h:65}]}),
};
export const character:CharacterDefinition={id:'gut',displayName:'GUT',description:'Kung fu · 1.80 m',color:'#cc4440',skins:[{id:'original',name:'Dress shirt'},{id:'kung-fu',name:'Kung fu'}],stats:{maxHealth: 1500,walkSpeed:4,backwardSpeed:3,jumpVelocity:22,gravity:1,weight:115},moves,
 basicAttacks:{chain:['palm','cross','finish'],heavy:'axe',kick:'swing',crouch:'crouch',air:'air'},
 weaponExpiryMove:'spearThrow',
 weaponAttacks:{chain:['thrust','sweep','spearFinish'],heavy:'spearHeavy',kick:'spearSwing',crouch:'spearLow',air:'spearAir',doubleJumpHeavy:'spearDive'},
 specialButtons:['hug','meditation'],superButtons:['immortal','panda'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite',duration:30}])),sounds:{hit:'impact'},effects:{hit:'impact'},assets:{atlas:'/art/gut/atlas-1.png',portrait:'/art/gut/portrait-user-shirt-v2.png',alternatePortrait:'/art/gut/portrait-user-kung-fu-v2.png'},states:{}};
