import {SceneRenderer} from './rendering/SceneRenderer.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {activateFinance} from '../../../packages/game-core/simulation/FinanceSystem.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
import {Button} from '../../../packages/game-core/types.js';
const renderer=new SceneRenderer(document.querySelector('canvas')!);
await renderer.prepareFighters(['biel','gut']);
let game:GameSimulation,scene='idle',tick=0,paused=false;
const setup=()=>{tick=0;game=new GameSimulation(['biel','gut'],false,undefined,undefined,[(document.querySelector('select') as HTMLSelectElement).value,'original']);game.state.phase='fight';game.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=900+i*500;f.meter=100;});
 const f=game.state.fighters[0];if(['flight','feathers','dive','beam','bills'].includes(scene)){activateFinance(game.state,game.stage,f,0,characters.biel.moves.angel);f.y=300;}
 if(scene==='coins')game.state.fighters[1].x=f.x+280;
 if(scene==='loan-walk')activateFinance(game.state,game.stage,f,0,characters.biel.moves.loan);
 if(scene==='feathers')game.state.fighters[1].x=f.x+140;
 if(scene==='beam')game.state.fighters[1].x=f.x+90;
 if(scene==='dive'){f.x=game.state.fighters[1].x-100;f.y=450;}if(scene==='loan')game.state.fighters[1].x=f.x+100;
 if(scene==='bills')f.angelUntil=60;
 document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===scene)));
};
const step=()=>{tick++;let input=0;const f=game.state.fighters[0];
 if(scene==='walk'){input=Button.Right;f.x=900;} // A treadmill keeps every frame visible for footwork review.
 if(scene==='loan-walk'){if(tick<80){input=Button.Right;f.x=900;}else if(tick<150){input=Button.Left;f.x=900;}else if(tick===160)input=Button.Up;else if(tick>215)input=Button.Down;}
 if(scene==='basics')input=({1:Button.Light,25:Button.Light,50:Button.Light,105:Button.Medium,180:Button.Heavy} as Record<number,number>)[tick]??0;
 if(scene==='wine'&&tick===1)input=Button.Special;
 if(scene==='coins'&&tick===1)input=Button.Special2;
 if(scene==='loan')input=tick===1?Button.Super1:tick===50?Button.Light:0;
 if(scene==='angel'&&tick===1)input=Button.Super2;
 if(scene==='flight')input=tick<90?Button.Up|Button.Right:tick<180?Button.Down|Button.Left:0;
 if(scene==='feathers')input=tick%70===1?Button.Light:0;
 if(scene==='dive'&&tick===1)input=Button.Medium;
 if(scene==='beam')input=tick<180?Button.Heavy|Button.Right|Button.Up:Button.Right;
 game.step([input,0]);renderer.consume(game.events);
 document.querySelector('#status')!.textContent=`${scene.toUpperCase()} · frame ${tick} · ${f.state} ${f.move??''} · ${f.stampAttempts!==undefined?f.stampAttempts+' stamps · ':''}${f.angelUntil?Math.max(0,Math.ceil((f.angelUntil-game.state.frame)/60))+'s flying · ':''}${game.state.fighters[1].loanUntil?'LOAN '+Math.ceil((game.state.fighters[1].loanUntil!-game.state.frame)/60)+'s · ':''}opponent HP ${game.state.fighters[1].health}`;
 if(tick>(scene==='angel'?1710:scene==='loan'?1950:scene==='coins'?380:scene==='bills'?400:240))setup();
};
document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(b=>b.onclick=()=>{scene=b.dataset.scene!;setup();});document.querySelector('select')!.onchange=setup;
document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{paused=!paused;document.querySelector('#pause')!.textContent=paused?'Play':'Pause';};document.querySelector<HTMLButtonElement>('#step')!.onclick=()=>{paused=true;document.querySelector('#pause')!.textContent='Play';step();};
setup();let previous=performance.now(),accumulator=0;
const draw=(now:number)=>{accumulator+=Math.min(100,now-previous);previous=now;while(accumulator>=1000/60){if(!paused)step();accumulator-=1000/60;}renderer.draw(game.state,1/60,game.state.frame/60,false,game.stage);requestAnimationFrame(draw);};requestAnimationFrame(draw);
