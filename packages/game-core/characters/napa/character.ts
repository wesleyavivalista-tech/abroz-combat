import {Button} from '../../types.js';
import {move} from '../common.js';
import type {CharacterDefinition,MoveDefinition} from '../../types.js';
const hit=(id:string,p:Partial<MoveDefinition>={})=>move(id,{cancelRules:[],...p});
const standing=['Idle','WalkForward','WalkBackward','Crouch','DashForward','DashBackward'];
const moves={
 jab:hit('jab',{displayName:'Punch',damage:48,knockback:3}),
 cross:hit('cross',{displayName:'Cross',damage:58,startupFrames:6,activeFrames:4,recoveryFrames:14,knockback:4}),
 comboKick:hit('comboKick',{displayName:'Combo kick',damage:82,startupFrames:8,activeFrames:5,recoveryFrames:20,knockback:14,hitboxes:[{x:20,y:45,w:125,h:50}]}),
 heavyKick:hit('heavyKick',{displayName:'Heavy kick',state:'HeavyAttack',damage:115,startupFrames:15,activeFrames:6,recoveryFrames:24,priority:3,launch:11,knockdown:true,hitboxes:[{x:20,y:45,w:140,h:90}]}),
 heavyPunch:hit('heavyPunch',{displayName:'Heavy punch',state:'HeavyAttack',damage:100,startupFrames:12,activeFrames:5,recoveryFrames:22,priority:3,knockback:18,hitboxes:[{x:20,y:60,w:120,h:60}]}),
 low:hit('low',{displayName:'Low kick',state:'CrouchingAttack',level:'low',damage:60,hitboxes:[{x:20,y:5,w:110,h:35}]}),
 air:hit('air',{displayName:'Air kick',state:'AirAttack',damage:75,startupFrames:7,activeFrames:9,recoveryFrames:14,hitboxes:[{x:10,y:25,w:115,h:65}]}),
 cookie:hit('cookie',{displayName:'Cookie',state:'SpecialMove',damage:85,meterCost:20,startupFrames:18,activeFrames:1,recoveryFrames:22,hitboxes:[],projectile:{arenaRange:true,speed:10,lifetime:100,radius:20,visual:'cookie'}}),
 sniff:hit('sniff',{displayName:'Super Sniff',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:25,startupFrames:18,activeFrames:90,recoveryFrames:22,hitboxes:[],suction:{range:1470,strength:4,holdButton:Button.Special2,drainInterval:36,drainAmount:5}}),
 cookieMonster:hit('cookieMonster',{displayName:'Cookie Monster',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:180,activeFrames:1,recoveryFrames:24,hitboxes:[],summonCookieMonster:true}),
 sneeze:hit('sneeze',{displayName:'Mega Sneeze',state:'SpecialMove',allowedStates:standing,damage:0,meterGain:0,meterCost:100,startupFrames:45,activeFrames:1,recoveryFrames:30,hitboxes:[],snotFrames:5100}),
 bossBarrage:hit('bossBarrage',{displayName:'Cookie Barrage',state:'SpecialMove',damage:0,meterGain:0,startupFrames:45,activeFrames:1,recoveryFrames:60,hitboxes:[]}),
 bossCookie:hit('bossCookie',{displayName:'Giant cookie',damage:90,knockback:12,hitboxes:[],projectile:{speed:7,lifetime:270,radius:30,visual:'cookie'}}),
 bossSlam:hit('bossSlam',{displayName:'Dough Slam',state:'HeavyAttack',damage:160,knockback:22,launch:8,knockdown:true,priority:3,startupFrames:48,activeFrames:8,recoveryFrames:60,piercing:true,hitboxes:[{x:10,y:0,w:270,h:95}]}),
 bossChomp:hit('bossChomp',{displayName:'Cookie Chomp',state:'HeavyAttack',damage:145,knockback:13,knockdown:true,priority:3,startupFrames:30,activeFrames:8,recoveryFrames:50,advance:5,hitboxes:[{x:10,y:30,w:155,h:180}]}),
};
export const character:CharacterDefinition={id:'napa',displayName:'NAPA',description:'Cookies & chaos · 1.76 m',color:'#d8a36b',skins:[{id:'original',name:'Brown tee'},{id:'gym',name:'Gym tank'}],stats:{maxHealth:1400,walkSpeed:5,backwardSpeed:4,jumpVelocity:22,gravity:1,weight:100},moves,basicAttacks:{chain:['jab','cross','comboKick'],heavy:'heavyKick',kick:'heavyPunch',crouch:'low',air:'air'},specialButtons:['cookie','sniff'],superButtons:['cookieMonster','sneeze'],specialMoves:[],animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:'sprite' as const,duration:30}])),sounds:{hit:'impact',special:'impact'},effects:{hit:'light-hit'},assets:{portrait:'/art/napa/portrait-cookie-1.png',alternatePortrait:'/art/napa/portrait-cookie-2.png',atlas:'/art/napa/combat-1.png',alternateAtlas:'/art/napa/combat-2.png'},states:{}};
