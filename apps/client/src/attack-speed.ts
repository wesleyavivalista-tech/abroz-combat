import {characters} from '../../../packages/game-core/characters/registry.js';
import {basicAttacks} from '../../../packages/game-core/characters/common.js';
import type {MoveDefinition} from '../../../packages/game-core/types.js';
import {escapeMarkup as esc} from './ui/FighterPresentation.js';

const timing=(frames:number)=>`${frames}f / ${Math.round(frames*1000/60)} ms`;
const fighters=Object.values(characters);
const moves=(c:typeof fighters[number])=>{
 const b=basicAttacks(c);
 return [...b.chain.map((id,i)=>({label:`Basic 1 · hit ${i+1}`,move:c.moves[id]})),
 ...([['Basic 2',b.heavy],['Basic 3',b.kick],['Crouch',b.crouch],['Air',b.air],['Double-jump Basic 2',b.doubleJumpHeavy]] as const)
 .filter(([,id])=>id).map(([label,id])=>({label,move:c.moves[id!]}))];
};
function note(m:MoveDefinition){
 return m.holdInvisible?'Held invisibility; no damaging active window.':m.dive?'Active phase lasts until landing; full duration varies.':m.returningProjectile?'Projectile travel adds time to contact; weapon return controls availability.':'—';
}
const app=document.querySelector<HTMLElement>('#app')!;
app.innerHTML=`<header><a class="brand" href="/">// ABROZ COMBAT</a><a href="/basic-attacks.html">Damage comparison ↗</a></header>
<section class="intro"><div><p class="eyebrow">ROSTER / ATTACK SPEED</p><h1>Basic attack speed<br><span>Every fighter.</span></h1><p class="lead">Current base-form move timings, read directly from the game definitions. Refresh this page after editing the game to see updated values.</p></div><aside><strong>60 simulation frames = 1 second</strong><p>Lower startup means the attack becomes active sooner. Full duration measures commitment, not damage or overall strength.</p><button id="reload" type="button">Refresh timings ↻</button></aside></section>
<section class="controls"><label>Find a fighter<input id="search" type="search" placeholder="Search name…"></label><label>Order by<select id="order"><option value="roster">Roster order</option><option value="startup">Fastest Basic 1 opener</option></select></label><span id="count"></span></section>
<h2>Standing attack startup comparison</h2><div class="table-wrap"><table><caption class="sr-only">Startup frames and milliseconds for all fighters</caption><thead><tr><th>Fighter</th><th>Basic 1 opener</th><th>Basic 2</th><th>Basic 3</th></tr></thead><tbody id="comparison"></tbody></table></div>
<section class="notes"><div><h2>How to read timings</h2><p><b>Startup:</b> delay before activation. <b>Active:</b> hit/effect window. <b>Recovery:</b> remaining animation. <b>Full duration:</b> startup + active + recovery, without early combo follow-up or interruption.</p><p>Milliseconds are rounded. Hitstop, slow motion, network stalls, buffs, transformations and travel can change observed timing. Active time does not mean damage occurs every frame.</p></div><div><h2>Controls & scope</h2><p>Basic 1: Xbox X / keyboard J. Basic 2: Y / K. Basic 3: B / L. Keyboard keys refer to Player 1; custom bindings can differ. Fresh Basic 1 presses advance the combo; holding does not automatically chain.</p><p>Normal forms only. Persistent and held moves are marked separately. Local source edits appear here immediately on reload; the public website updates only after deployment.</p></div></section>
<section id="timings" aria-label="Full move timings"></section><p id="empty" hidden>No fighters match your search.</p>`;
function render(){
 const query=document.querySelector<HTMLInputElement>('#search')!.value.toLowerCase().trim();
 const visible=fighters.filter(c=>c.displayName.toLowerCase().includes(query));
 if(document.querySelector<HTMLSelectElement>('#order')!.value==='startup')visible.sort((a,b)=>a.moves[basicAttacks(a).chain[0]].startupFrames-b.moves[basicAttacks(b).chain[0]].startupFrames);
 document.querySelector('#count')!.textContent=`${visible.length} / ${fighters.length} fighters`;
 document.querySelector<HTMLElement>('#empty')!.hidden=visible.length>0;
 document.querySelector('#comparison')!.innerHTML=visible.map(c=>{const b=basicAttacks(c);return `<tr><th scope="row"><a href="#fighter-${c.id}">${esc(c.displayName)}</a></th>${[b.chain[0],b.heavy,b.kick].map(id=>`<td>${timing(c.moves[id].startupFrames)}${c.moves[id].holdInvisible?' (invisibility)':''}</td>`).join('')}</tr>`;}).join('');
 document.querySelector('#timings')!.innerHTML=visible.map(c=>`<section id="fighter-${c.id}"><h2>${esc(c.displayName)}</h2><div class="table-wrap"><table><caption class="sr-only">${esc(c.displayName)} full basic move timings</caption><thead><tr><th>Input / move</th><th>Startup</th><th>Active</th><th>Recovery</th><th>Full duration</th><th>Notes</th></tr></thead><tbody>${moves(c).map(({label,move:m})=>`<tr><th scope="row">${label}<small>${esc(m.displayName??m.id)}</small></th><td>${timing(m.startupFrames)}</td><td>${m.holdInvisible?'Held effect':m.dive?'Until landing':timing(m.activeFrames)}</td><td>${timing(m.recoveryFrames)}</td><td>${m.holdInvisible||m.dive?'Variable':timing(m.startupFrames+m.activeFrames+m.recoveryFrames)}</td><td class="move-note">${note(m)}</td></tr>`).join('')}</tbody></table></div></section>`).join('');
}
document.querySelector<HTMLInputElement>('#search')!.oninput=render;
document.querySelector<HTMLSelectElement>('#order')!.onchange=render;
document.querySelector<HTMLButtonElement>('#reload')!.onclick=()=>location.reload();
render();
