import type {DuckKind} from './AudioMix.js';
import {personalitySounds} from './FighterAudio.js';
export type AudioBus = 'music' | 'combat' | 'ui' | 'ambience' | 'voice';
export interface SoundDefinition {
  layers?: string[]; // Optional complementary one-shots, limited to one layer level.
  assets?: string[]; // Optional recorded variants; URLs belong here only.
  bus: AudioBus;
  gain: number;
  priority: number;
  maxInstances: number;
  cooldown: number; // milliseconds, shared across fighters
  variation: number;
  spatial: boolean;
  loop?: boolean;
  duck?: DuckKind; // Only significant events request music attenuation.
  fallback?: { from: number; to: number; duration: number; wave: OscillatorType };
}
const cue = (bus: AudioBus, gain: number, priority: number, from: number, to: number, duration: number, wave: OscillatorType = 'sine'): SoundDefinition =>
  ({ bus, gain, priority, maxInstances: 3, cooldown: 45, variation: .03, spatial: bus === 'combat', fallback: { from, to, duration, wave } });
// Retain and tune the existing oscillator fallback. Recorded assets can replace it independently.
export const sounds: Record<string, SoundDefinition> = {
  ...personalitySounds,
  attack_light: cue('combat', .045, 25, 280, 100, .10),
  attack_heavy: cue('combat', .055, 40, 220, 65, .16),
  attack_special: cue('combat', .065, 55, 420, 110, .20),
  attack_ultimate: { ...cue('combat', .085, 90, 180, 45, .38, 'triangle'), cooldown: 180, spatial: false,duck:'ultimate' },
  hit_light: cue('combat', .09, 40, 160, 45, .12, 'sawtooth'),
  hit_heavy: cue('combat', .115, 65, 120, 30, .23, 'triangle'),
  hit_special: cue('combat', .105, 70, 210, 38, .23, 'sawtooth'),
  ground_slam: cue('combat', .12, 75, 85, 25, .32, 'triangle'),
  block: cue('combat', .085, 85, 650, 260, .10, 'triangle'),
  projectile: cue('combat', .035, 25, 420, 100, .12),
  metal: cue('combat', .05, 45, 164.8, 82.4, .30, 'sawtooth'),
  jump: { ...cue('combat', .025, 10, 160, 280, .10), cooldown: 90 },
  dash: { ...cue('combat', .025, 10, 250, 90, .09), cooldown: 100 },
  land: { ...cue('combat', .035, 15, 100, 40, .08, 'triangle'), cooldown: 100 },
  ko: { ...cue('combat', .13, 100, 200, 30, .5, 'triangle'), spatial: false, cooldown: 160,duck:'ko' },
  stun: { ...cue('combat', .035, 45, 700, 500, .14), cooldown: 600 },
  menu_hover: { ...cue('ui', .025, 15, 450, 500, .045), cooldown: 80, maxInstances: 1 },
  menu_confirm: cue('ui', .055, 50, 380, 620, .10),
  menu_back: cue('ui', .045, 50, 440, 220, .10),
  invalid: { ...cue('ui', .04, 60, 170, 120, .12, 'triangle'), cooldown: 250 },
  fighter_selected: cue('ui', .06, 55, 300, 520, .14),
  ready: { ...cue('ui', .065, 65, 400, 800, .18), cooldown: 120 },
  joined: { ...cue('ui', .045, 60, 300, 600, .14), cooldown: 180 },
  disconnected: { ...cue('ui', .05, 85, 600, 220, .22), cooldown: 250 },
  final_death: {...cue('ui',.22,100,90,24,.65,'triangle'),cooldown:600,variation:0},
  grave_break: {...cue('combat',.13,80,150,35,.35,'sawtooth'),cooldown:80},
  undead_hit: cue('combat',.1,65,180,40,.18,'triangle'),
  ...Object.fromEntries(['three','two','one'].map((name,i)=>[`countdown_${3-i}`,{...cue('voice',.65,100,110,38,.32,'triangle'),assets:[`/audio/announcer/${name}.wav`],maxInstances:1,cooldown:500,variation:0}])),
  countdown: { ...cue('ui', .14, 80, 110, 38, .32, 'triangle'), cooldown: 500, variation: 0 },
  round_start: { ...cue('voice', .65, 100, 190, 32, .55, 'triangle'), assets:['/audio/announcer/fight.wav'],maxInstances:1,cooldown:400,variation:0 },
  round_end: { ...cue('ui', .065, 95, 700, 250, .25), cooldown: 400 },
  victory: { ...cue('ui', .08, 100, 440, 880, .4), cooldown: 500 },
  defeat: { ...cue('ui', .065, 100, 330, 110, .4), cooldown: 500 },
  special_ready: { ...cue('ui', .025, 55, 500, 650, .12), cooldown: 3000 },
  ultimate_ready: { ...cue('ui', .045, 75, 600, 1000, .20), cooldown: 3000 },
  low_health: { ...cue('ui', .035, 75, 180, 140, .20), cooldown: 5000 },
  // Intentionally silent until designed recordings are supplied, not arbitrary beeps.
  ...Object.fromEntries(['poison', 'slow', 'buff', 'armor', 'armor_break', 'mode_end', 'summon', 'trap', 'reflect'].map(id => [id, { bus: 'combat', gain: .07, priority: 45, maxInstances: 2, cooldown: 500, variation: .02, spatial: true } satisfies SoundDefinition])),
};
/** Optional per-fighter overrides: e.g. eide: { attack_special: 'eide_seller' }. */
export const characterSounds: Record<string, Partial<Record<string, string>>> = {};
export const legacySounds: Record<string, string> = { ui: 'menu_confirm', impact: 'hit_light', hit: 'hit_light', counter: 'hit_heavy', 'dash-dust': 'dash', 'landing-dust': 'land', 'blood-jump': 'jump', respawn: 'ready' };
