import {SceneRenderer} from './rendering/SceneRenderer.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
const renderer=new SceneRenderer(document.querySelector('canvas')!);
await renderer.prepareFighters(['astolfo','jopa']);
const game=new GameSimulation(['astolfo','astolfo','jopa','jopa'],false,undefined,undefined,['original','casual','original','casual']);
game.state.phase='fight';
const [pose,facing,personality]=[...document.querySelectorAll('select')];
function setup(){
 game.state.fighters.forEach((f,i)=>{f.x=350+i*550;f.move=null;f.facing=Number(facing.value) as 1|-1;f.state=pose.value==='forward'?'DashForward':pose.value==='idle'?'Idle':'DashBackward';f.stateFrame=Number(pose.value)||0;if(i<2)f.personality=personality.value==='normal'?undefined:personality.value as 'sad'|'angry';});
 document.querySelector('#labels')!.innerHTML=['Astolfo · suit','Astolfo · casual','Jopa · Santos','Jopa · white tee'].map(label=>`<strong>${label}</strong>`).join('');
}
[pose,facing,personality].forEach(select=>select.onchange=setup);setup();
let raf=0;function draw(){renderer.draw(game.state,1/60,0,false,game.stage);raf=requestAnimationFrame(draw);}draw();
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);renderer.dispose();},{once:true});
