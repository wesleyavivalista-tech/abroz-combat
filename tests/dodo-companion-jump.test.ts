import test from 'node:test';
import assert from 'node:assert/strict';
import {createFighter} from '../packages/game-core/simulation/Fighter.js';
import {companionJumpPose} from '../apps/client/src/rendering/DodoCompanionPresentation.js';
for(let variant=0;variant<3;variant++)test(`Painkiller ${variant+1} uses takeoff, rise, apex, fall and landing`,()=>{
 const f=createFighter('dodo',1000,1);f.companionVariant=variant;
 f.state='JumpStartup';assert.equal(companionJumpPose(f),1);
 f.state='Jump';f.stateFrame=4;f.vy=12;assert.equal(companionJumpPose(f),2);
 f.vy=2;assert.equal(companionJumpPose(f),3);
 f.state='Fall';assert.equal(companionJumpPose(f),4);
 f.state='Land';f.stateFrame=0;assert.equal(companionJumpPose(f),5);
 f.stateFrame=6;assert.equal(companionJumpPose(f),0);
 f.state='Idle';assert.equal(companionJumpPose(f),null);
 f.state='Fall';f.move='pkJab';assert.equal(companionJumpPose(f),null);
 f.move=null;f.state='AirHitStun';assert.equal(companionJumpPose(f),null);
});

import {GameSimulation} from '../packages/game-core/simulation/GameSimulation.js';
import {summonClones} from '../packages/game-core/simulation/HairSystem.js';
test('all three companions rise and descend onto a platform while pursuing a target',()=>{
 const g=new GameSimulation(['dodo','gut']);g.state.phase='fight';
 const platform=g.stage.platforms![0];
 for(const f of g.state.fighters)f.state='Idle';
 g.state.fighters[0].x=platform.x+100;
 const target=g.state.fighters[1];target.x=platform.x+platform.width-50;target.y=platform.y;target.health=100000;
 summonClones(g.state,0,g.stage);
 const seen=new Map(g.state.clones.map(c=>[c.id,new Set<string>()]));
 for(let tick=0;tick<180;tick++){
  g.step([0,0]);
  for(const c of g.state.clones){const phases=seen.get(c.id)!;phases.add(c.fighter.state);if(c.fighter.y===platform.y)phases.add('platform');}
 }
 for(const phases of seen.values()){assert.ok(phases.has('Jump'));assert.ok(phases.has('Fall'));assert.ok(phases.has('platform'));}
});
