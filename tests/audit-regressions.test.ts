import "./fixtures/legacy-roster.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GameSimulation } from "../packages/game-core/simulation/GameSimulation.js";
import { characters, registerCharacter, validateCharacter } from "../packages/game-core/characters/registry.js";
import { Button } from "../packages/game-core/types.js";
import { fighterPresentation, registerFighterPresentation } from "../apps/client/src/ui/FighterPresentation.js";
import { selectionScreen } from "../apps/client/src/ui/MenuScreens.js";

test("airborne hitstun integrates horizontal knockback only once per tick", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);sim.state.phase = "fight";
  const f = sim.state.fighters[0];Object.assign(f,{x:500,y:100,vy:0,vx:10,stun:10,state:"AirHitStun"});
  sim.step([0,0]);assert.equal(f.x,508);assert.equal(f.vx,8);
});
test("projectile knocks target along travel direction after owner turns away", () => {
  const sim = new GameSimulation(["prototype-a", "prototype-b"]);sim.state.phase = "fight";
  const [a,b]=sim.state.fighters;Object.assign(a,{x:500,state:"Idle",facing:-1});Object.assign(b,{x:900,state:"Idle"});
  Object.assign(sim.state.projectiles[0],{active:true,owner:0,x:875,y:85,vx:10,life:100,move:"special",serial:1});
  // Directly fix owner in a move facing away so automatic facing does not turn them.
  a.move="light";a.moveFrame=0;
  sim.step([0,0]);assert.ok(b.vx>0);assert.ok(b.health<1400);
});
test("new fighter can use its own move IDs and presentation without modifying simulation or menu", () => {
  const original=characters["prototype-a"];
  const aliases=Object.fromEntries(Object.keys(original.moves).map(id=>[id,`custom-${id}`]));
  const c={...original,id:"audit-fighter",displayName:"AUDIT",moves:Object.fromEntries(Object.entries(original.moves).map(([id,m])=>[aliases[id],{...m,id:aliases[id],cancelRules:m.cancelRules.filter(k=>aliases[k]).map(k=>aliases[k])}])),basicAttacks:{chain:[aliases.light,aliases.chain2,aliases.chain3] as [string,string,string],heavy:aliases.heavy,kick:aliases.kick,crouch:aliases.crouch,air:aliases.air},specialButtons:original.specialButtons.map(k=>aliases[k]) as [string,string],superButtons:original.superButtons.map(k=>aliases[k]) as [string,string],specialMoves:original.specialMoves.map(m=>({...m,move:aliases[m.move]}))};
  registerCharacter(c);
  try {
    const sim=new GameSimulation([c.id,c.id]);sim.state.phase="fight";sim.state.fighters.forEach(f=>f.state="Idle");
    sim.step([Button.Light,0]);assert.equal(sim.state.fighters[0].move,aliases.light);
    sim.step([0,0]);sim.step([Button.Light,0]);for(let i=0;i<15;i++)sim.step([0,0]);
    assert.equal(sim.state.fighters[0].move,aliases.chain2);
    assert.equal(fighterPresentation(c.id).portrait,"/art/fighter-placeholder.svg");
    registerFighterPresentation(c.id,{portrait:"/custom.png",style:"CUSTOM STYLE",facing:"left"});
    const html=selectionScreen("local",[c.id,"prototype-a"],0,true,c.id);
    assert.ok(html.includes("/custom.png"));assert.ok(!html.includes("CUSTOM STYLE"));assert.ok(!html.includes("02 ARENA"));
    assert.throws(()=>validateCharacter({...c,moves:{}}),/missing move/);
  } finally { delete characters[c.id]; }
});
