import {SceneRenderer} from './rendering/SceneRenderer.js';
import {mountedCatalog} from './rendering/MountedVisual.js';
import {GameSimulation} from '../../../packages/game-core/simulation/GameSimulation.js';
import {activateJopa} from '../../../packages/game-core/simulation/JopaSystem.js';
import {characters} from '../../../packages/game-core/characters/registry.js';
const renderer=new SceneRenderer(document.querySelector('canvas')!);
await renderer.prepareFighters(['jopa',...mountedCatalog.flat()]);
const selects=[...document.querySelectorAll('select')];
let game:GameSimulation;
function setup(){
 const ids=mountedCatalog[Number(selects[0].value)],skin=Number(selects[1].value),facing=Number(selects[2].value) as 1|-1;
 game=new GameSimulation(ids,false,undefined,[0,0,1,1],ids.map(id=>characters[id].skins![skin].id));
 game.state.phase='fight';
 game.state.fighters.forEach((f,i)=>{f.state='Idle';f.x=350+i*550;f.facing=facing;activateJopa(game.state,game.stage,f,i,characters.jopa.moves.knight);});
 document.querySelector('#names')!.replaceChildren(...ids.map(id=>{const label=document.createElement('span');label.textContent=characters[id].displayName+' · '+characters[id].skins![skin].name;return label;}));
}
selects.forEach(select=>select.onchange=setup);setup();
function draw(){renderer.draw(game.state,1/60,0,false,game.stage);requestAnimationFrame(draw);}draw();
