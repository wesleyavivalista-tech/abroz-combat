import {SceneRenderer} from './rendering/SceneRenderer.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {activateJopa,cleanupJopa} from '../../../packages/game-core/simulation/JopaSystem.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
const renderer=new SceneRenderer(document.querySelector('canvas')!);await renderer.prepareFighters(['jopa','gut']);
const game=new GameSimulation(['jopa','gut']);game.state.phase='fight';game.state.fighters.forEach(f=>f.state='Idle');game.state.fighters[0].x=900;game.state.fighters[1].x=1600;
activateJopa(game.state,game.stage,game.state.fighters[0],0,characters.jopa.moves.tree);game.state.clones[0].fighter.health=0;cleanupJopa(game.state,game.stage);game.state.clones=[];
const select=document.querySelector('select')!;select.onchange=()=>{game.state.frame=Number(select.value);};
function draw(){renderer.draw(game.state,1/60,0,false,game.stage);requestAnimationFrame(draw);}draw();
