import {SceneRenderer} from './rendering/SceneRenderer.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {activateJopa,cleanupJopa} from '../../../packages/game-core/simulation/JopaSystem.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {Button} from '../../../packages/game-core/types.js';
const renderer=new SceneRenderer(document.querySelector('canvas')!);
await renderer.prepareFighters(['jopa','gut','astolfo','tocha']);
let game:GameSimulation;let scene='ready';let previewFrame=0;
const setup=()=>{
 previewFrame=0;
 const skin=(document.querySelector('select') as HTMLSelectElement).value;
 game=new GameSimulation(['jopa','gut','astolfo','tocha'],false,undefined,[0,0,1,1],[skin,'original','original','original']);
 game.state.phase='fight';game.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=[850,1350,1750,2000][i];f.meter=100;});
 const f=game.state.fighters[0];
 if(['football','chess','tree','knight','ally','impact'].includes(scene))activateJopa(game.state,game.stage,f,0,characters.jopa.moves[scene==='ally'||scene==='impact'?'knight':scene]);
 if(scene==='place'){f.move='chess';f.moveFrame=15;f.state='SpecialMove';}
 if(scene==='impact'){const k=game.state.clones[0];k.fighter.x=game.state.fighters[2].x;k.fighter.y=170;k.fighter.vy=-8;}
 if(scene==='ally'){game.step([Button.Medium,0,0,0]);const knight=game.state.clones[0];knight.nextAction=10000;game.state.fighters[1].x=knight.fighter.x+100;game.step([0,Button.Medium,0,0]);}
 if(scene==='tree'){for(let i=0;i<361;i++)game.step([0,0,0,0]);}
 if(scene==='chess'){for(let i=1;i<5;i++)activateJopa(game.state,game.stage,f,0,characters.jopa.moves.chess);game.state.projectiles.filter(p=>p.active).forEach((p,i)=>{p.x=1050+i*130;p.y=85;});}
 cleanupJopa(game.state,game.stage);
 document.querySelector('#status')!.textContent=scene==='place'?'Chess Master · set a piece on the ground · 2-second stun':scene==='impact'?'Knight impact · backward bounce, impact burst and 1-second stun':scene==='knight'||scene==='ally'?'Chess Knight · 700 health · allies can ride · K mounts/dismounts · jump and double jump':scene==='tree'?'Crying Tree · 980 health · protected Jopa · 140-health tentacles every 3 seconds · platform jumping · 10 active maximum':scene==='football'?'Football · 3 seconds · ricochets and repeated hits':scene==='chess'?'Chess Master · five pieces · hopping attacks and 2-second stun':'Approved portraits and fighter identity · Santos Skin 1, White tee Skin 2';
};
document.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{scene=b.dataset.scene!;setup();});document.querySelector('select')!.onchange=setup;setup();
const draw=()=>{if(scene==='impact'){if(previewFrame++>140)setup();game.step([0,0,0,0]);renderer.consume(game.events);}renderer.draw(game.state,1/60,game.state.frame/60,false,game.stage);requestAnimationFrame(draw);};draw();
