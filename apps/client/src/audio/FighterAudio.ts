import {characters} from '../../../../packages/game-core/characters/registry.js';
import type {SoundDefinition} from './SoundRegistry.js';
export type SoundPhase='start'|'active'|'impact'|'end';
export interface MoveAudio {swingOnActive?:boolean;charge?:string;family:string;start:string;active:string;impact:string;end:string;}
/** Material briefs are requirements for original/licensed recordings, never fake file URLs. */
export const materials:Record<string,string>={
 punch:'Short cloth swing; dry flesh contact, three to five variations',kick:'Fast trouser swish and deeper foot/body thud',head:'Dense blunt forehead knock, no metallic ring',body:'Heavy body mass, low thump and cloth compression',slam:'Ground impact, low boom and scattered concrete debris',
 bees:'Natural bee swarm buzz, rising approach and brief stings',wood:'Wood placement, hollow knocks, splintered breakup',football:'Inflated leather football kick, hollow rebound and body contact',chess:'Wooden chess pieces rattling and clacking',tree:'Wood growth, creaking branches and comic sobbing',knight:'Chess mount hoof-like wooden clops and heavy wooden contact',
 wine:'Bottle movement, glass clink and wet wine splash',coins:'Metal coin shower, scattered tinkling and settling',stamp:'Office stamp clack and paper slap',angel:'Original short celestial transformation swell, wings and expiration',feather:'Feather flurry, slicing air and soft cuts',sword:'Steel blade swish, cut transient and short metallic detail',divine:'Celestial beam charging, sustained airy radiance and dissipating tail',
 appliance:'Bulky household appliance rattle, impact and loose components',romance:'Original playful romantic motif and gentle pulse',mutant:'Muscle growth, fabric strain and weighty transformation release',talk:'Original expressive nonverbal chatter, quieter sustained babble and stop',spider:'Small dry leg skitters and sharp bite',personality:'Two contrasting original comic motifs for summoned personalities',idea:'Original bright idea sting and restrained chatter aura',paper:'Paper folding, fluttering, sharp paper cuts and crumple',cloud:'Soft air bloom, white cloud hiss and dispersal',ancestry:'Sword draw and original ceremonial transformation motif',anger:'Short growl, rising tension and release',
 cookie:'Baked cookie toss, brittle crack and crumbs',sniff:'Comedic inhalation, sustained suction and breath release',monster:'Original dough creature emergence, rumble and crumble',sneeze:'Original explosive sneeze, wet splatter and drip',chomp:'Exaggerated dough bite and crumb crunch',flex:'Muscular flex, fabric creak and controlled breath',gym:'Exertion grunts, repeated lifting effort and throw',perfection:'Original triumphant sports transformation sting',guitar:'Wooden guitar-body knock with strings rattling',chord:'Original electric guitar chord, resonant wave and damped strings',stealth:'Soft cloth vanish, muted air and reappearance',basketball:'Rubber basketball release, hollow bounce and squeak',band:'Original short band entrance cue with companion movement',star:'Original guitar flourish for star mode and final muted chord',buda:'Deep resonant transformation with original ceremonial motif',hug:'Cloth squeeze and brief body compression',meditation:'Controlled breath, soft sustained resonance and exhale',immortal:'Original brief restorative motif',panda:'Heavy martial-arts transformation, cloth and breath',spear:'Wood shaft swish, pointed metal contact and retract',fire:'Flame ignition, restrained crackle, flare impact and extinguish',metalMusic:'Original distorted guitar sting with infernal fire, no borrowed riffs',hair:'Fibrous hair whip, bristling swish and soft snap',plush:'Fluffy fabric expansion, muffled padding and deflation',shadow:'Dark airy vanish, faint movement and return',blood:'Thick liquid splash, low gurgle and draining tail',dart:'Light blow-dart launch and small puncture',axe:'Heavy axe sweep, chopping impact and short steel/wood detail',gear:'Firefighter buckles, heavy fabric and armor contact',juggle:'Light juggling ball release, rubber bounce and hand catch',water:'Valve opening, pressurized hose stream, splashing contact and valve closure',product:'Boxed product rattle, packaging impact and tumble',masonry:'Brick placement, structural rumble and crumbling debris',turret:'Mechanical deployment, gears, cannon report and metal breakup',
};
const groups:Record<string,Record<string,string>>={
 nikalz:{head:'forehead heavyHead foreheadDive testada',bees:'bees',slam:'meteor',wood:'beeHouse placeBox'},
 jopa:{football:'football',chess:'chess',tree:'tree',knight:'knight'},
 biel:{wine:'wine',coins:'coins',stamp:'loan stamp',angel:'angel',feather:'feathers',sword:'dive',divine:'divine'},
 eide:{appliance:'seller bahia',romance:'love',mutant:'mutant',body:'giantPunch charge flyingKick'},
 astolfo:{talk:'talking',spider:'spider',personality:'bipolar',idea:'idea'},
 fausto:{paper:'origami',cloud:'cloud',ancestry:'ancestry',anger:'bravinho',sword:'slash finishSlash flash swordHeavy swordLow swordAir'},
 napa:{cookie:'cookie bossBarrage bossCookie',sniff:'sniff',monster:'cookieMonster',sneeze:'sneeze',slam:'bossSlam',chomp:'bossChomp'},
 jomp:{flex:'coolMuscles',body:'investida',gym:'gymBro',perfection:'perfection'},
 dodo:{guitar:'guitarSwing heavy',chord:'chord starWave',stealth:'lowProfile',band:'painKillers',star:'guitarStar',basketball:'ball'},
 drupa:{body:'swing1 swing2 bellyFinish belly wide low rolling budaSwing1 budaSwing2 budaFinish budaSky',slam:'bellyDive',divine:'bald budaBeam budaForward',buda:'buda'},
 gut:{hug:'hug',meditation:'meditation',immortal:'immortal',panda:'panda',spear:'spearThrow thrust sweep spearFinish spearHeavy spearSwing spearLow spearDive spearAir'},
 tocha:{fire:'jab cross finisher heavy double crouch air fireball ignite',metalMusic:'pentagram satan'},
 bozo:{hair:'beard heavy spear grip clones',plush:'armor'},
 caio:{shadow:'vanish',blood:'pool flood master',dart:'dart',kick:'crouch air'},
 roms:{axe:'chop backhand cleave heavy toss low air spin',gear:'gear',juggle:'juggle straight straight2 straight3 up bounce finale',water:'water'},
 luizinho:{product:'seller',masonry:'wall home build',turret:'turret cannon'},
};
export const fighterAudio:Record<string,Record<string,MoveAudio>>={};
export const personalitySounds:Record<string,SoundDefinition>={};
export const assetBriefs:Record<string,string>={};
for(const c of Object.values(characters)){
 const overrides=Object.fromEntries(Object.entries(groups[c.id]??{}).flatMap(([family,ids])=>ids.split(' ').map(id=>[id,family])));
 fighterAudio[c.id]={};
 for(const m of Object.values(c.moves)){
  const family=overrides[m.id]??(/kick|sweep/i.test(m.displayName??'')?'kick':'punch');
  const ultimate=c.superButtons?.includes(m.id),heavy=m.damage>=100;
  const mapping={family} as MoveAudio;
  for(const phase of ['start','active','impact','end'] as const){
   const id=`${c.id}.${m.id}.${phase}`;mapping[phase]=id;
   const physical=['punch','kick','head','body','slam'].includes(family);
   const duration=family==='slam'?.32:family==='body'?.22:family==='kick'?.17:.11;
   personalitySounds[id]={bus:'combat',gain:phase==='active'?.025:phase==='impact'?(heavy?.105:.075):.035,priority:phase==='active'?12:ultimate?90:heavy?65:40,maxInstances:phase==='active'?2:3,cooldown:phase==='active'?200:70,variation:phase==='active'?0:.04,spatial:true,loop:phase==='active',
    ...(physical&&(phase==='start'||phase==='impact')?{fallback:{from:phase==='start'?240:family==='head'?180:family==='kick'?130:100,to:phase==='start'?80:30,duration,wave:'triangle' as const}}:{})};
   assetBriefs[id]=`${c.displayName} / ${m.displayName??m.id} / ${phase}: ${materials[family]}. ${phase==='active'?'Seamless quiet loop; no transient or long tail.':'Short one-shot; compatible variations with matched loudness.'}`;
  }
  fighterAudio[c.id][m.id]=mapping;
 }
 for(const phase of ['jump','dash','land','heavy_land','victory','burn','poison','slow','armor','armor_break','mode_end','stun'] as const){
  const id=`${c.id}.${phase}`;
  personalitySounds[id]={bus:phase==='victory'?'ui':'combat',gain:.05,priority:phase==='victory'?95:20,maxInstances:2,cooldown:150,variation:.02,spatial:phase!=='victory'};
  if(['jump','dash','land','heavy_land'].includes(phase)){const heavy=c.id==='drupa'||c.id==='jomp';personalitySounds[id].fallback={from:phase==='dash'?250:heavy?75:120,to:phase==='jump'?200:30,duration:heavy?.16:.09,wave:'triangle'};}
  assetBriefs[id]=`${c.displayName}: ${phase}. Identity: ${Object.keys(groups[c.id]??{}).map(k=>materials[k]).join('; ')}. Keep short, original and restrained.`;
 }
}
export function moveAudio(character:string,move:string):MoveAudio|undefined{return fighterAudio[character]?.[move];}

// Layer assets may be shared across moves; slots do not require unique files.
for(const [family,brief] of Object.entries({debris:'Scattered concrete/brick debris after a large ground or structure impact',steel:'Short restrained metallic contact detail; no sustained bell',wood:'Hollow wooden resonance and splinters',splash:'Short water splash onto body and ground',cloth:'Brief heavy cloth/body compression'})){
 const id=`layer.${family}`;
 personalitySounds[id]={bus:'combat',gain:.035,priority:30,maxInstances:2,cooldown:120,variation:.035,spatial:true};assetBriefs[id]=brief;
}
for(const moves of Object.values(fighterAudio))for(const profile of Object.values(moves)){
 const layer=({slam:'debris',masonry:'debris',axe:'steel',sword:'steel',spear:'wood',guitar:'wood',water:'splash',body:'cloth'} as Record<string,string>)[profile.family];
 if(layer)personalitySounds[profile.impact].layers=[`layer.${layer}`];
}

// Audible original procedural assets shared by material, with three impact takes.
for(const moves of Object.values(fighterAudio))for(const profile of Object.values(moves)){
 for(const phase of ['start','active','impact','end'] as const){
  const cue=personalitySounds[profile[phase]];
  cue.assets=(phase==='impact'?[1,2,3].map(i=>`impact-${i}`):[phase]).map(file=>`/audio/materials/${profile.family}/${file}.wav`);
  cue.gain=phase==='active'?.035:phase==='impact'?.28:phase==='start'?.16:.09;
 }
}
for(const c of Object.values(characters))for(const phase of ['burn','poison','slow','armor','armor_break','mode_end','stun','victory']){
 const family=phase==='burn'?'fire':phase==='poison'?'liquid':phase==='stun'?'head':phase==='victory'?Object.keys(groups[c.id])[0]:phase==='armor'||phase==='armor_break'?'gear':'cloud';
 const material=family==='liquid'?'blood':family;
 const stage=phase==='armor_break'||phase==='mode_end'?'end':phase==='stun'?'impact-1':'start';
 personalitySounds[`${c.id}.${phase}`].assets=[`/audio/materials/${material}/${stage}.wav`];
 personalitySounds[`${c.id}.${phase}`].gain=phase==='victory'?.22:.12;
}
for(const [layer,family] of Object.entries({debris:'masonry',steel:'sword',wood:'wood',splash:'water',cloth:'body'}))personalitySounds[`layer.${layer}`].assets=[`/audio/materials/${family}/impact-2.wav`];

// Original locally synthesized PCM effects (scripts/create-nikalz-audio.py).
const nikalzClip=(slot:string,files:string[],gain:number)=>{
 const cue=personalitySounds[`nikalz.${slot}`];cue.assets=files.map(f=>`/audio/nikalz/${f}.wav`);cue.gain=gain;
};
for(const move of ['foreheadDive','testada'])nikalzClip(`${move}.impact`,['forehead-1','forehead-2','forehead-3'],.38);
nikalzClip('meteor.impact',['meteor-1','meteor-2','meteor-3'],.46);
nikalzClip('bees.start',['swarm-release'],.24);
nikalzClip('bees.active',['swarm-loop'],.12);
nikalzClip('bees.impact',['swarm-sting'],.3);
nikalzClip('bees.end',['swarm-end'],.14);
nikalzClip('placeBox.active',['swarm-loop'],.045);

// Combat-only foley pass. Ability identities, transformations and ambience stay intact.
const combatMaterials:Record<string,string>={punch:'fist',head:'fist',kick:'foot',body:'body',sword:'blade',axe:'axe',spear:'shaft',guitar:'guitar',chord:'guitar',hair:'whip',fire:'flame'};
for(const c of Object.values(characters))for(const m of Object.values(c.moves)){
 const profile=fighterAudio[c.id][m.id],material=combatMaterials[profile.family];
 const melee=m.hitboxes.length>0&&!c.specialButtons?.includes(m.id)&&!c.superButtons?.includes(m.id);
 if(!material||(!melee&&!m.chargeFrames))continue;
 const weight=m.chargeFrames?'charged':m.state==='HeavyAttack'||m.damage>=130?'heavy':'light';
 profile.swingOnActive=true;
 for(const [phase,file] of [['start','swing'],['impact','hit']] as const){
  const cue=personalitySounds[profile[phase]];
  cue.assets=[1,2,3].map(i=>`/audio/combat-v2/${material}-${weight}-${file}-${i}.wav`);
  cue.gain=phase==='start'?(weight==='light'?.18:.23):(weight==='light'?.29:weight==='heavy'?.36:.43);
  cue.variation=phase==='start'?.035:.025;cue.cooldown=0;cue.maxInstances=5;
  cue.priority=phase==='impact'?(weight==='charged'?88:78):weight==='charged'?65:35;
  // Contact detail is already mixed into the new take; avoid doubling old layers.
  if(phase==='impact')delete cue.layers;
 }
 if(m.chargeFrames){
  profile.charge=`${c.id}.${m.id}.charge`;
  personalitySounds[profile.charge]={bus:'combat',assets:['/audio/combat-v2/charge.wav'],gain:.075,priority:18,maxInstances:2,cooldown:0,variation:0,spatial:true,loop:true};
 }
}
