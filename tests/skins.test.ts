import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import type { WebSocket } from "ws";
import type { ServerMessage } from "../packages/shared/protocol.js";
import { characters, registerCharacter, validateCharacter } from "../packages/game-core/characters/registry.js";
import { fighterSkins, resolveSkin } from "../packages/game-core/characters/skins.js";
import { GameSimulation } from "../packages/game-core/simulation/GameSimulation.js";
import { RoomService } from "../apps/server/src/rooms.js";
import { registerFighterPresentation, fighterPresentation } from "../apps/client/src/ui/FighterPresentation.js";
import { selectionScreen } from "../apps/client/src/ui/MenuScreens.js";
import { registerFighterVisual, createFighterVisual } from "../apps/client/src/rendering/VisualRegistry.js";
import { Button } from "../packages/game-core/types.js";
const character={...characters["prototype-a"],id:"skin-test",skins:[{id:"original",name:"Original"},{id:"street",name:"Street"},{id:"night",name:"Night"}]};
function client(){const messages:ServerMessage[]=[];return {messages,socket:{readyState:1,send:(s:string)=>messages.push(JSON.parse(s))} as unknown as WebSocket};}
test("skin catalogue supports three or more looks and rejects invalid definitions",()=>{
  assert.equal(fighterSkins(character).length,3);
  assert.equal(resolveSkin(character),"original");assert.equal(resolveSkin(character,"night"),"night");
  assert.throws(()=>resolveSkin(character,"missing"),/Unknown skin/);
  assert.throws(()=>validateCharacter({...character,skins:[]}),/Invalid fighter skins/);
  assert.throws(()=>validateCharacter({...character,skins:[character.skins[0],character.skins[0]]}),/Invalid fighter skins/);
  assert.equal(resolveSkin(characters["prototype-b"]),"original");
});
test("different skins preserve identical combat and survive snapshots and respawn",()=>{
 registerCharacter(character);
 try {
  const a=new GameSimulation([character.id,character.id],false,undefined,undefined,["original","night"]);
  const b=new GameSimulation([character.id,character.id],false,undefined,undefined,["street","original"]);
  for(let i=0;i<250;i++){const input=i%20===0?[Button.Special,Button.Light]:[Button.Right,Button.Left];a.step(input);b.step(input);}
  const stateA=a.snapshot(),stateB=b.snapshot();stateA.skins=[];stateB.skins=[];assert.deepEqual(stateA,stateB);
  a.state.fighters[0].health=0;a.step([0,0]);for(let i=0;i<130;i++)a.step([0,0]);
  const snap=a.snapshot();a.resetPositions();a.restore(snap);assert.deepEqual(a.state.skins,["original","night"]);
  assert.throws(()=>new GameSimulation([character.id,character.id],false,undefined,undefined,["night"]),/One skin/);
 }finally{delete characters[character.id];}
});
test("server validates skins and distributes each seat's choice in team rooms",()=>{
 registerCharacter(character);
 try {
  const rooms=new RoomService(), c=Array.from({length:4},client);
  assert.throws(()=>rooms.create(c[0].socket,character.id,4,"2v2",0,"missing"),/Unknown skin/);
  assert.equal(rooms.rooms.size,0);
  rooms.create(c[0].socket,character.id,4,"2v2",0,"night");const code=[...rooms.rooms.keys()][0];
  assert.throws(()=>rooms.join(c[1].socket,code,character.id,1,"missing"),/Unknown skin/);
  rooms.ready(c[0].socket);
  for(let i=1;i<4;i++){rooms.join(c[i].socket,code,character.id,i%2,i===1?"street":"original");rooms.ready(c[i].socket);}
  for(const peer of c){const start=peer.messages.find(m=>m.type==="start");assert.equal(start?.type,"start");if(start?.type==="start")assert.deepEqual(start.skins,["night","street","original","original"]);}
 }finally{delete characters[character.id];}
});
test("selection, portrait and playable factory resolve the chosen skin independently for each seat",()=>{
 registerCharacter(character);
 try {
  registerFighterPresentation(character.id,{portrait:"/base.png",style:"TEST",facing:"right",skins:{night:{portrait:"/night.png",facing:"left"}}});
  const html=selectionScreen("local",[character.id,character.id],1,false,character.id,["original","night"]);
  assert.ok(html.includes('value="night" selected'));assert.ok(html.includes('/night.png'));assert.ok(html.includes('/base.png'));for(const skin of character.skins)assert.ok(html.includes(`value="${skin.id}"`));
  assert.equal(fighterPresentation(character.id,"night").facing,"left");
  const base={root:new THREE.Group(),update(){},dispose(){}},night={...base,root:new THREE.Group()};
  registerFighterVisual(character.id,()=>base);registerFighterVisual(character.id,()=>night,"night");
  assert.equal(createFighterVisual(character,"night").root,night.root);assert.equal(createFighterVisual(character,"original").root,base.root);
 }finally{delete characters[character.id];}
});
