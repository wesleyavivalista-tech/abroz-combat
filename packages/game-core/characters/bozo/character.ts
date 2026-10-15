import type { CharacterDefinition } from "../../types.js";
import { move } from "../common.js";
const moves = {
  jab: move("jab", {displayName:"Jab", cancelRules:[], knockback:3}),
  cross: move("cross", {displayName:"Cross", cancelRules:[], startupFrames:6, activeFrames:4, recoveryFrames:14, damage:58, hitstun:24, knockback:4}),
  beard: move("beard", {displayName:"Beard lash", cancelRules:[], startupFrames:9, activeFrames:5, recoveryFrames:22, damage:85, knockback:14, priority:2, hitboxes:[{x:15,y:65,w:170,h:55}]}),
  heavy: move("heavy", {displayName:"Heavy beard", cancelRules:[], state:"HeavyAttack", startupFrames:18, activeFrames:7, recoveryFrames:26, damage:130, priority:3, knockback:18, launch:10, knockdown:true, hitboxes:[{x:10,y:30,w:190,h:110}]}),
  kick: move("kick", {displayName:"Kick", cancelRules:[], state:"MediumAttack", startupFrames:10, activeFrames:5, recoveryFrames:19, damage:78, knockback:12, hitboxes:[{x:20,y:45,w:115,h:55}]}),
  crouch: move("crouch", {displayName:"Low kick", cancelRules:[], state:"CrouchingAttack", level:"low", startupFrames:8, activeFrames:5, recoveryFrames:18, damage:60, hitboxes:[{x:20,y:5,w:105,h:35}]}),
  air: move("air", {displayName:"Air kick", cancelRules:[], state:"AirAttack", level:"high", startupFrames:7, activeFrames:9, recoveryFrames:16, damage:70, hitboxes:[{x:10,y:35,w:115,h:55}]}),
  spear: move("spear", {meterCost:25, displayName:"Body hair", cancelRules:[], state:"SpecialMove", startupFrames:26, activeFrames:8, recoveryFrames:30, damage:100, priority:2, knockback:18, hitboxes:[{x:15,y:60,w:1291,h:50}]}),
  grip: move("grip", {meterCost:25, displayName:"Hair grip", cancelRules:[], state:"SpecialMove", startupFrames:23, activeFrames:3, recoveryFrames:34, damage:0, knockback:0, hitstun:12, trapFrames:180, hitboxes:[], projectile:{speed:11,lifetime:75,radius:26,visual:"hair"}}),
  armor: move("armor", {displayName:"Bunda de Pelucia", cancelRules:[], state:"SpecialMove", startupFrames:24, activeFrames:3, recoveryFrames:20, damage:0, meterCost:100, meterGain:0, hitboxes:[], armorFrames:1320}),
  clones: move("clones", {displayName:"Hair clones", cancelRules:[], state:"SpecialMove", startupFrames:36, activeFrames:3, recoveryFrames:28, damage:0, meterCost:100, meterGain:0, hitboxes:[], summonClones:3}),
};
export const character: CharacterDefinition = {
 companionHealth:{ratio:1/3,offset:-60},
 id:"bozo",displayName:"BOZO",description:"Beard & body hair · 1.64 m",color:"#c6a16d",
 skins:[{id:"original",name:"Polo"},{id:"basketball",name:"Basketball"}],
 stats:{maxHealth: 1450,walkSpeed:4,backwardSpeed:3,jumpVelocity:22,gravity:1,weight:110},
 moves,basicAttacks:{chain:["jab","cross","beard"],heavy:"heavy",kick:"kick",crouch:"crouch",air:"air"},
 specialButtons:["spear","grip"],superButtons:["armor","clones"],specialMoves:[{motion:"236",move:"spear"}],
 animations:Object.fromEntries(Object.keys(moves).map(id=>[id,{kind:"sprite",duration:30}])),
 sounds:{hit:"impact"},effects:{hit:"impact"},assets:{atlas:"/art/bozo/atlas-1.png",alternateAtlas:"/art/bozo/atlas-2.png",portrait:"/art/bozo/portrait-1-hair-v2.png",alternatePortrait:"/art/bozo/portrait-2-hair-v2.png"},states:{},
};
