export const TICK_RATE = 60;
export const enum Button {
  Left = 1,
  Right = 2,
  Up = 4,
  Down = 8,
  Light = 16,
  Medium = 32,
  Heavy = 64,
  Special = 128,
  Special2 = 256,
  Super1 = 512,
  Super2 = 1024,
}
export type InputState = number;
export type FighterState =
  | "Idle"
  | "WalkForward"
  | "WalkBackward"
  | "Crouch"
  | "JumpStartup"
  | "Jump"
  | "Fall"
  | "Land"
  | "LightAttack"
  | "MediumAttack"
  | "HeavyAttack"
  | "CrouchingAttack"
  | "AirAttack"
  | "BlockStanding"
  | "BlockCrouching"
  | "HitStunStanding"
  | "HitStunCrouching"
  | "AirHitStun"
  | "Knockdown"
  | "GetUp"
  | "DashForward"
  | "DashBackward"
  | "SpecialMove"
  | "MatchIntro"
  | "MatchWin"
  | "MatchLose"
  | "Respawning"
  | "KO"
  | (string & {});
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface InputSample {
  frame: number;
  mask: number;
  pressed: number;
  direction: number;
}
export interface TimelineEvent {
  frame: number;
  type: "effect" | "sound";
  id: string;
}
export interface MoveDefinition {
  nikalzAbility?: "shock"|"bees"|"meteor"|"boxes"|"place"|"dive";
  eideAbility?: "seller"|"bahia"|"love";
  financeAbility?: "coins"|"stamp-mode"|"angel"|"feathers"|"dive";
  loanStamp?: boolean;
  slowFrames?: number;
  jopaAbility?: "football"|"chess"|"tree"|"knight";
  displayName?: string;
  id: string;
  input: string;
  animation: string;
  state: FighterState;
  allowedStates?: FighterState[];
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  damage: number;
  hitstun: number;
  blockstun: number;
  knockback: number;
  launch: number;
  knockdown: boolean;
  meterGain: number;
  meterCost: number;
  priority: number;
  level: "high" | "mid" | "low";
  cancelRules: string[];
  cancelFrame: number;
  hitboxes: Box[];
  hurtboxes?: Box[];
  effects: string;
  events: TimelineEvent[];
  structure?: StructureDefinition;
  reactivation?: string;
  buildMarkedStructure?: boolean;
  projectile?: { arenaRange?:boolean; cardinal?:boolean; variants?: number; originX?: number; originY?: number; speed: number; lifetime: number; radius?: number; visual?: "appliance" | "wine" | "feather" | "fire" | "pentagram" | "hair" | "spear" | "poison" | "product" | "cannonball" | "sound" | "basketball" | "cookie"; homing?: boolean };
  burn?: { duration: number; damage: number; kind?: "normal" | "purple" };
  hazard?: { duration: number; radius: number; damage: number; interval: number; startFrame?: number; burn?: {duration:number;damage:number;kind?: "normal" | "purple"} };
  returningProjectile?: string;
  durationClock?: 'move'|'simulation';
  periodicMelee?: {interval:number;rangeX:number;rangeY:number;hitstun:number;push:number};
  ownerFloodSpeed?: number;
  mobile?: boolean;
  holdInvisible?: number;
  invisibilityFrames?: number;
  chargeFrames?: number;
  flashDash?: boolean;
  origamiTrap?: boolean;
  whiteCloudFrames?: number;
  talking?: boolean;
  spider?: boolean;
  personalitySplit?: boolean;
  talkAuraFrames?: number;
  angerFrames?: number;
  poisonFrames?: number;
  poisonDamage?: number;
  bloodPoolFrames?: number;
  bloodFloodFrames?: number;
  bloodMasterFrames?: number;
  auraFrames?: number;
  armorFrames?: number;
  trapFrames?: number;
  summonClones?: number;
  summonCookieMonster?: boolean;
  snotFrames?: number;
  suction?: {range:number;strength:number;holdButton?:number;drainInterval?:number;drainAmount?:number};
  grappleFrames?: number;
  weaponFrames?: number;
  extraLife?: boolean;
  /** Explicit exception to the shared Special/Ultimate execution armor. */
  executionArmor?: false;
  /** Hold the input to channel; healing uses simulation ticks, not animation speed. */
  channelHeal?: { button: number; interval: number; amount: number };
  fixedStun?: boolean;
  arenaRoll?: boolean;
  beam?: {originProfile?:"hose";initialAim?:number;clipToArena?:boolean;targetProfile?:"body"|"lower-stance";push?:number;width:number;originY:number;originX?:number;interval:number;steerable?:boolean;fullCircle?:boolean;float?:number;continuous?:boolean;upward?:boolean;downward?:boolean;holdButton?:number};
  piercing?: boolean;
  advance?: number;
  selfLaunch?: number;
  dive?: { speed: number; drift: number };
}
export interface ReturningPath {
 motion:'vertical'|'straight'|'bounce';weapon?:boolean;finale?:boolean;
 speed:number;verticalSpeed:number;gravity:number;radius:number;hitInterval:number;life:number;
 exclusive?:boolean;
}
export interface CharacterDefinition {
  financeMoves?: {stamp:string;feathers:string;dive:string;beam:string};
  /** Cosmetic variants; the first entry is the default. */
  skins?: { id: string; name: string }[];
  id: string;
  displayName: string;
  description: string;
  color: string;
  stats: {
    maxHealth: number;
    walkSpeed: number;
    backwardSpeed: number;
    jumpVelocity: number;
    gravity: number;
    weight: number;
  };
  animations: Record<
    string,
    { kind: "procedural" | "sprite" | "model"; duration: number }
  >;
  moves: Record<string, MoveDefinition>;
  basicAttacks?: { chain: [string, string, string, ...string[]]; heavy: string; kick: string; crouch: string; air: string; doubleJumpHeavy?: string };
  weaponAttacks?: CharacterDefinition["basicAttacks"];
  returningPaths?: Record<string,ReturningPath>;
  returningCapacity?: number;
  modeFinale?: {move:string;path:string;duration:number;velocities:[number,number][]};
  modeDirectInputs?: boolean;
  armorDamageTaken?: number;
  auraTrailMove?: string;
  maxAirJumps?: number;
  dashMultiplier?: number;
  weaponExpiryMove?: string;
  musicFighter?: boolean;
  muscleFighter?: boolean;
  companionStyle?: "basketball";
  companionHealth?: {ratio:number;offset:number};
  weaponModifiers?: {hitReactionArmor?:boolean;damage?:number;attackSpeed?:number;dash?:number;airJumps?:number;speed:number;damageTaken:number;bodyScale:number;basicsOnly:boolean;label:string};
  specialMoves: { motion: string; move: string }[];
  specialButtons: [string, string];
  superButtons: [string, string];
  sounds: Record<string, string>;
  effects: Record<string, string>;
  assets: Record<string, string>;
  states: Record<string, (fighter: Fighter, frame: number) => void>;
}
export interface Fighter {
  undead?: "grave"|"rising"|"zombie"|"dying";
  diveStunImmuneUntil?:number; beeBoxes?:number; beeSlowUntil?:number; nikalzStunUntil?:number; meteorStart?:number; meteorX?:number; meteorY?:number;
  npcPlatform?:number; loveMode?:boolean; loveNpc?:boolean; npcEntrance?:{fromX:number;takeoffX:number;landingX:number;targetX:number;floorY:number;targetY:number;elapsed:number;lastFrame:number}; npcHitAt?:number; npcDefeatedAt?:number; applianceVariant?:number; applianceSeed?:number;
  loanUntil?:number; loanStunUntil?:number; movementSlowUntil?:number;
  stampAttempts?:number; angelUntil?:number; angelBurstAt?:number; coinHitAt?:number;
  jopaSummon?: "tree"|"tentacle"|"knight";
  jopaTree?: number;
  jopaRide?: number;
  jopaStunUntil?: number;
  chessIndex?: number;
  personality?: "sad"|"angry";
  talkUntil?: number;
  talkNextDrain?: number;
  talkNextPulse?: number;
  talkSlow?: number;
  sadnessUntil?: number;
  cookieBoss?: boolean;
  angerUntil?: number;
  angerStacks?: number;
  cloudSlow?: number;
  origamiSeed?: number;
  flexNextDrain?:number;
  gymTarget?:number;
  gymStartedAt?:number;
  gymNextRep?:number;
  gymLandingStun?:boolean;
  gymStunnedUntil?:number;
  invisibleUntil?: number;
  lowProfileNoticeUntil?: number;
  musicNextPulse?: number;
  chargeStartedAt?: number;
  chargeButton?: number;
  companionVariant?: number;
  productIndex?: number;
  returningWeaponOut?: boolean;
  modeFinaleUntil?: number;
  actionUntil?: number;
  characterId: string;
  beamAim: number;
  weaponUntil: number;
  grappleUntil: number;
  grappleOwner: number;
  grappleNextTick: number;
  hitTargets: string[];
  trappedUntil: number;
  armorUntil: number;
  burnKind: "normal" | "purple";
  burnUntil: number;
  burnNextTick: number;
  burnDamage: number;
  burnOwner: number;
  burnOwned?:boolean;
  burnNeutral?:boolean;
  onFireUntil: number;
  speedRemainder: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  lives: number;
  usedSupers: string[];
  airJumpUsed: boolean;
  airJumpsUsed: number;
  poisonUntil: number;
  poisonNextTick: number;
  poisonDamage: number;
  poisonOwner: number;
  poisonOwned?:boolean;
  poisonNeutral?:boolean;
  floodSpeed: number;
  bloodSlowUntil: number;
  bloodMasterUntil: number;
  areaSlow: number;
  respawnAt: number;
  invulnerableUntil: number;
  meter: number;
  facing: 1 | -1;
  state: FighterState;
  stateFrame: number;
  move: string | null;
  moveFrame: number;
  connected: boolean;
  stun: number;
  /** Ordinary hit reaction preserved independently of absolute ability locks. */
  timedHitReaction?: number;
  beamPulse?: {serial:number;move:string;index:number};
  consecutiveHits: number;
  lastStunHitFrame: number;
  hitstunImmuneUntil: number;
  dazed?: boolean;
  combo: number;
  comboDamage: number;
  lastDamage: number;
  buffer: InputSample[];
  previousInput: number;
  attackSerial: number;
  projectileSpawned: boolean;
}
export interface Projectile {
  footballDamage?: number;
  soundWave?: {chain:string;travel:number;range:number;generation:number;continuous:boolean;burst:string;hits:string[];visited:string[]};
  owned?:boolean;
  jopaKind?: "football"|"chess";
  expiresAt?: number;
  nextHop?: number;
  gravity?: number;
  bounces?: number;
  companionId?: number;
  variant?: number;
  trajectory?: string;
  vy?: number;
  age?: number;
  returning?: boolean;
  nextHits?: Record<string,number>;
  active: boolean;
  owner: number;
  x: number;
  y: number;
  vx: number;
  life: number;
  move: string;
  serial: number;
}
export interface Hazard {
  launchX?: number; launchY?: number;
  variant?: number;
  kind?: "honey" | "coin-rain" | "money-bill" | "angel-burst" | "spider" | "spider-bite" | "sad-burst" | "angry-burst" | "origami" | "paper-burst" | "white-cloud" | "flash-slash" | "fire-trail" | "blood-pool" | "blood-trail" | "blood-flood" | "snot" | "cookie-drop" | "cookie-crumbs";
  createdAt?: number;
  width?: number;
  height?: number;
  owner: number; x: number; y: number; expiresAt: number; move: string; nextTicks: number[];
}
export interface HairClone { invasion?: import('./simulation/InvasionSystem.js').InvasionVariant; id: number; owner: number; fighter: Fighter; undead?: {phaseAt:number; target:number; nextAttack:number; attackAt:number; attackFrame:number; hit:boolean; stuck:number; lastX:number; spawnX:number; spawnY:number}; kind?: "undead" | "blonde" | "sad" | "angry" | "basketball" | "cookie-monster" | "tree" | "tentacle" | "knight"; rider?:number; bornAt?:number; nextJump?:number; reboundUntil?:number; recoveryUntil?:number; landingHitReadyAt?:number; impactAt?:number; nextAction?:number; pattern?:number; variant?: number; maxHealth?: number; }
export interface StructureDefinition {
 kind: "wall"|"turret"|"house"|"bee-box"; width:number; height:number; healthRatio:number; duration:number; offset:number;
 shotMove?:string; interval?:number; collapseDamage?:number; collapseStun?:number;
}
export interface Structure {
 id:number; owner:number; move:string; kind:StructureDefinition["kind"]; phase:"marked"|"built"|"collapsed";
 x:number; y:number; width:number; height:number; health:number; maxHealth:number; createdAt:number; expiresAt:number; nextShot:number; shots:number;
 trapped:string[]; hits:Record<string,number>; facing:1|-1; lastHitAt?:number; hitX?:number; hitY?:number; aimX?:number; aimY?:number;
}
export interface BeeSwarm {id:number;owner:number;x:number;y:number;originX:number;originY:number;born:number;range:number;period:number;direction:number;vertical:number;}
export interface ForeheadWave {owner:number;x:number;y:number;born:number;range:number;speed:number;meteor:boolean;hits:string[];}
export interface FinalDeath {seat:number; x:number; y:number; frame:number; facing:1|-1; spawned?:boolean;}
export interface SimulationSnapshot {
  statistics?:import('./simulation/MatchStatistics.js').MatchStatistics;
  invasion?: import('./simulation/InvasionSystem.js').InvasionState;
  finalDeaths?: FinalDeath[];
  platformTick?: number;
  bees?:BeeSwarm[]; nextBeeId?:number; foreheadWaves?:ForeheadWave[];
  elimination?: import("./simulation/EliminationSystem.js").EliminationState;
  tournament?: {wins:number[];round:number;scoredRound:number;withdrawn:number[];complete:boolean;champion:number;byForfeit:boolean};
 structures?: Structure[];
 nextStructureId?: number;
  clones: HairClone[];
  treeDeaths?: {id:number;x:number;y:number;facing:1|-1;startedAt:number}[];
  nextCloneId: number;
  hazards: Hazard[];
  skins: string[];
  teams: number[];
  teamMatch: boolean;
  frame: number;
  fighters: Fighter[];
  projectiles: Projectile[];
  endedAt: number;
  phase: "intro" | "fight" | "result";
  phaseFrame: number;
  hitstop: number;
  winner: number;
  training: boolean;
}
export interface CombatEvent {
  id: string;
  type: string;
  x: number;
  y: number;
  power: number;
  player: number;
}
export interface StageDefinition {
  artwork?: string;
  theme?: "rooftop" | "basketball" | "mall" | "church";
  /** Indices of the two platforms used by Eide's Love summons. */
  eideLovePlatforms?: [number, number];
  /** Fractional positions across the selected platforms; defaults to their centers. */
  eideLoveOffsets?: [number, number];
  id: string;
  name: string;
  width: number;
  floorHeight: number;
  platforms?: { x: number; y: number; width: number; motion?: {from:number;to:number;period:number;phase?:number} }[];
  cameraBounds: [number, number];
  background: string;
  lighting: { ambient: number; key: string };
  music: string;
}
export interface TrainingOptions {
  infiniteMeter: boolean;
  dummy: "stand" | "crouch" | "jump" | "block" | "afterHit";
}
