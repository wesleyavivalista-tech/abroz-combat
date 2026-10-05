import {SceneRenderer} from './rendering/SceneRenderer.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {activateEide} from '../../../packages/game-core/simulation/EideSystem.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {Button} from '../../../packages/game-core/types.js';
const renderer=new SceneRenderer(document.querySelector('canvas')!);
await renderer.prepareFighters(['eide','gut']);
let game:GameSimulation,scene='idle',tick=0,paused=false;
const setup=()=>{tick=0;game=new GameSimulation(['eide','gut'],false,undefined,undefined,[(document.querySelector('select') as HTMLSelectElement).value,'original']);game.state.phase='fight';game.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=850+i*500;f.meter=100;});
 const f=game.state.fighters[0];if(['love-walk','blondes'].includes(scene))activateEide(game.state,game.stage,f,0,characters.eide.moves.love);
 if(['giant','charge','kick','mutant-walk'].includes(scene))f.weaponUntil=1200;
 if(scene==='bahia')game.state.fighters[1].x=1550;
 document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===scene)));
};
const step=()=>{tick++;let input=0;const f=game.state.fighters[0];
 if(['walk','love-walk','mutant-walk'].includes(scene)){input=Button.Right;f.x=850;}
 if(scene==='basics')input=({1:Button.Light,25:Button.Light,50:Button.Light,105:Button.Medium,180:Button.Heavy} as Record<number,number>)[tick]??0;
 if(scene==='seller'&&tick%90===1){f.meter=100;input=Button.Special;}
 if(scene==='bahia'&&tick%100===1){f.meter=100;input=Button.Special2;}
 if(scene==='love'&&tick===1)input=Button.Super1;
 if(scene==='mutant'&&tick===1)input=Button.Super2;
 if(scene==='giant'&&tick===1){game.state.fighters[1].x=f.x+180;input=Button.Light;}
 if(scene==='charge'&&tick===1)input=Button.Medium;
 if(scene==='kick'&&tick===1)input=Button.Heavy;
 if(scene==='blondes'){for(const c of game.state.clones){if(tick===240){c.fighter.health-=100;c.fighter.npcHitAt=game.state.frame;}if(tick===320)c.fighter.health=0;}}
 game.step([input,0]);renderer.consume(game.events);
 document.querySelector('#status')!.textContent=`${scene.toUpperCase()} · ${f.state} ${f.move??''} · ${f.weaponUntil?Math.ceil((f.weaponUntil-game.state.frame)/60)+' seconds mutant · ':''}${f.loveMode?'LOVE · ':''}${game.state.clones.map(c=>'Blonde '+((c.variant??0)+1)+' '+c.fighter.health+' HP · '+(c.fighter.npcEntrance?'entering':'on platform')).join(' · ')} · opponent ${game.state.fighters[1].health} HP`;
 if(tick>(scene==='mutant'?1350:scene==='love'||scene==='blondes'?420:scene==='seller'||scene==='bahia'?900:240))setup();
};
document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.onclick=()=>{scene=b.dataset.scene!;setup();});document.querySelector('select')!.onchange=setup;
document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'Play':'Pause';};document.querySelector<HTMLButtonElement>('#step')!.onclick=()=>{paused=true;document.querySelector('#pause')!.textContent='Play';step();};
setup();let previous=performance.now(),accumulator=0;
const draw=(now:number)=>{accumulator+=Math.min(100,now-previous);previous=now;while(accumulator>=1000/60){if(!paused)step();accumulator-=1000/60;}renderer.draw(game.state,1/60,game.state.frame/60,false,game.stage);requestAnimationFrame(draw);};requestAnimationFrame(draw);
