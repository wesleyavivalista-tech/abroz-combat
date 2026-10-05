import {SceneRenderer} from './rendering/SceneRenderer.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {Button} from '../../../packages/game-core/types.js';
import {damageStructure} from '../../../packages/game-core/simulation/StructureSystem.js';
const renderer=new SceneRenderer(document.querySelector('canvas')!);
await renderer.prepareFighters(['nikalz','gut']);
let game:GameSimulation,scene='idle',tick=0,paused=false;
const setup=()=>{tick=0;game=new GameSimulation(['nikalz','gut'],false,undefined,undefined,[(document.querySelector('select') as HTMLSelectElement).value,'original']);game.state.phase='fight';game.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=850+i*380;f.meter=100;});
 if(scene.startsWith('carry'))game.state.fighters[0].beeBoxes=5;
 if(scene==='dive')game.state.fighters[1].x=940;
 if(scene==='shock')game.state.fighters[1].x=1080;
 if(scene==='basics'||scene==='heavy')game.state.fighters[1].x=940;
 if(scene==='bees')game.state.fighters[1].x=1120;
 if(scene==='boxes'||scene==='destroy')game.state.fighters[1].x=1700;
 document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===scene)));
};
const step=()=>{tick++;let input=0;const f=game.state.fighters[0];
 if(scene==='carryJump')input=[1,22].includes(tick)?Button.Up:0;
 if(scene==='carryWalk'){input=Button.Right;f.x=850;}
 if(scene==='dash')input=[1,4,80,83].includes(tick)?Button.Right:0;
 if(scene==='carryDash')input=[1,4,80,83].includes(tick)?Button.Right:0;
 if(scene==='walk'){input=Button.Right;f.x=850;}
 if(scene==='basics')input=({1:Button.Light,15:Button.Light,35:Button.Light,55:Button.Light} as Record<number,number>)[tick]??0;
 if(scene==='heavy')input=tick===1?Button.Medium:tick===100?Button.Heavy:0;
 if(scene==='dive')input=[1,14].includes(tick)?Button.Up:tick===25?Button.Medium:0;
 if(scene==='shock'&&tick===1)input=Button.Special;
 if(scene==='bees'&&tick===1)input=Button.Special2;
 if(scene==='bees'&&tick>170&&tick<205)game.state.fighters[1].x-=3;
 if(scene==='meteor'&&tick===1)input=Button.Super1;
 if(scene==='boxes'||scene==='destroy'){
  if(tick===1)input=Button.Super2;
  if([65,110,155,200,245].includes(tick)){f.x=550+(tick-65)/45*150;input=Button.Light;}
  if(scene==='destroy'&&tick===320){const box=game.state.structures?.[2];if(box)damageStructure(game.state,box,650,'review-destruction',0,game.stage);}
 }
 game.step([input,0]);renderer.consume(game.events);
 if(scene==='victory'){f.state='MatchWin';f.move=null;}
 document.querySelector('#status')!.textContent=`${scene==='carryWalk'?'Four-step walk while holding the box':scene==='dash'?'Dash push-off, burst and braking':scene==='carryJump'?'Jump and double-jump while holding the box':scene==='carryDash'?'Dash while holding the box':scene==='walk'?'Alternating left and right steps':scene==='boxes'?'Place five boxes with any basic attack':scene==='destroy'?'Destroyed box drops honey':scene==='meteor'?'Damage falls with distance from impact':scene.toUpperCase()} · ${f.beeBoxes??0} boxes carried · ${game.state.bees?.length??0} swarms · opponent ${game.state.fighters[1].health} HP`;
 if(tick>(['boxes','destroy','meteor'].includes(scene)?540:scene==='bees'?360:240))setup();
};
document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.onclick=()=>{scene=b.dataset.scene!;setup();});document.querySelector('select')!.onchange=setup;
document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'Play':'Pause';};document.querySelector<HTMLButtonElement>('#step')!.onclick=()=>{paused=true;document.querySelector('#pause')!.textContent='Play';step();};
document.querySelector<HTMLButtonElement>('#step10')!.onclick=()=>{paused=true;document.querySelector('#pause')!.textContent='Play';for(let i=0;i<10;i++)step();};
setup();let previous=performance.now(),accumulator=0;
const draw=(now:number)=>{accumulator+=Math.min(100,now-previous);previous=now;while(accumulator>=1000/60){if(!paused)step();accumulator-=1000/60;}renderer.draw(game.state,1/60,game.state.frame/60,false,game.stage);requestAnimationFrame(draw);};requestAnimationFrame(draw);
