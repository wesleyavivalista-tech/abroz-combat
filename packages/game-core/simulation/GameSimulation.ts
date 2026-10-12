import {newMatchStatistics,beginStatisticsFrame,finishStatistics,spendEnergy,healTo,trackActivation} from './MatchStatistics.js';
import {advanceInvasionWaves,advanceInvasionBullets} from './InvasionSystem.js';
import {advanceAfterlife,advanceUndead} from './UndeadSystem.js';
import {hostile} from './Actors.js';
import {MATCH_INTRO_FRAMES} from './MatchIntro.js';
import {advancePlatforms,stageAtTick} from "../stages/motion.js";
import {activateNikalz,advanceNikalz,controlMeteor,nikalzRequest} from './NikalzSystem.js';
import {activateEide,advanceEide,keepEideNpc,inLove,EIDE,nextAppliance} from './EideSystem.js';
import {initializeElimination,advanceElimination,scoreElimination,type EliminationMode} from './EliminationSystem.js';
import {advanceFinance,activateFinance,controlFlight,financeRequest,flying,startFinanceMove} from './FinanceSystem.js';
import {energyLocked} from './EnergySystem.js';
import {activateJopa,advanceJopa,cleanupJopa,controlJopa} from './JopaSystem.js';
import {activateAstolfo,advanceAstolfo,advanceSpiders,burstPersonalities,personalitySpeed,personalityMovementSpeed} from './AstolfoSystem.js';
import {angerMultiplier} from './AngerSystem.js';
import {activateFausto,advanceFausto,triggerOrigami,isFlashDashing,FAUSTO} from './FaustoSystem.js';
import {activateNapa,advanceNapa,sniffSuppresses,dropMonsterCookies} from './NapaSystem.js';
import {advanceJomp,startJomp,gymTarget,coolMuscles,gymHolding,JOMP} from './JompSystem.js';
import {advanceTournament,scoreTournament} from './TournamentSystem.js';
import {advanceDodo,isLowProfile,lowProfileMove} from './DodoSystem.js';
import {advanceBasicMelee,basicMeleeTier} from '../combat/BasicMelee.js';
import {updateMovementFacing} from './FacingSystem.js';
import {activateStructure,advanceStructures,attackStructures,collideStructures,hitStructureProjectile,markedStructure} from './StructureSystem.js';
import {initializeProjectile} from './ProjectilePool.js';
import {canReceiveDirectHit} from '../combat/ContactPolicy.js';
import {clearGameplayEvents,gameplayEvents,observeFrame,recordGameplayEvent} from '../combat/GameplayEvents.js';
import {advanceAbilityTimers,activateTimedMove,frameCrossed} from './AbilityTimers.js';
import {advanceContinuousAttacks} from './ContinuousAttackSystem.js';
import {resolveHit} from '../combat/CombatSystem.js';
import {advanceReturningProjectiles,hitReturningProjectile,canSpawnReturningProjectile,spawnReturningProjectile} from './ReturningProjectileSystem.js';
import {advanceBlood, activateBlood, movementSlow, attackSlow} from './BloodSystem.js';
import {advanceFireTrails} from './FireTrailSystem.js';
import {advanceBeams,lightBeam,beamHitsFighter} from './LightBeamSystem.js';
import { advanceGrapples } from './GrappleSystem.js';
import { actors } from "./Actors.js";
import { cloneInput, summonClones } from "./HairSystem.js";
import { advanceStatuses } from "./StatusSystem.js";
import { resolveSkin } from "../characters/skins.js";
import {
  Button,
  type Fighter,
  type SimulationSnapshot,
  type TrainingOptions,
  type CombatEvent,
  type MoveDefinition,
  type StageDefinition,
} from "../types.js";
import { basicAttacks } from "../characters/common.js";
import { characters, defaultRoster } from "../characters/registry.js";
import { trainingRoom } from "../stages/registry.js";
import {
  record,
  motion,
  doubleTapHorizontal,
  doubleTapDown,
  bufferedButton,
  consumeButtons,
  direction,
} from "../input/InputBuffer.js";
import {
  intersects,
  sweepEntry,
  targetBoxes,
  hitboxes,
  pushApart,
} from "../combat/CollisionSystem.js";
import { enter, locked, isCounterState, allowsMove } from "./StateMachine.js";
import { createFighter as fighter } from "./Fighter.js";
import {
  retainsOwnedEntities,
  advanceRespawns,
  resolveKnockouts,
  isActive,
} from "./LifeSystem.js";
import { grounded, surfaceBelow } from "./StageCollision.js";
export class GameSimulation {
  state: SimulationSnapshot;
  events: CombatEvent[] = [];
  trainingOptions: TrainingOptions = { infiniteMeter: true, dummy: "stand" };
  constructor(
    ids: string[] = [...defaultRoster],
    training = false,
    public stage: StageDefinition = trainingRoom,
    teams: number[] = ids.map((_, i) => i),
    skins?: string[],
    tournament: boolean | EliminationMode = false,
    seed = 1,
  ) {
    if (ids.length < 2 || ids.length > 8 || ids.some((id) => !characters[id]))
      throw new Error("Choose 2–8 valid fighters");
    if (skins && skins.length !== ids.length) throw new Error("One skin is required per fighter");
    const selectedSkins = ids.map((id, i) => resolveSkin(characters[id], skins?.[i]));
    const teamMatch = new Set(teams).size < ids.length;
    if (teams.length !== ids.length || teams.some(t => !Number.isInteger(t) || t < 0) ||
      (teamMatch && (![4, 6].includes(ids.length) || teams.some(t => t > 1) || teams.filter(t => t === 0).length !== ids.length / 2)))
      throw new Error("Teams must be balanced 2v2 or 3v3");
    this.state = {
      clones: [], nextCloneId: 0,
      hazards: [],
      skins: selectedSkins,
      teams: [...teams],
      teamMatch,
      frame: 0,
      fighters: this.spawnFighters(ids, teams, teamMatch),
      projectiles: Array.from({ length: Math.max(48, ids.length * 8) }, () => ({
        active: false,
        owner: 0,
        x: 0,
        y: 0,
        vx: 0,
        life: 0,
        move: "",
        serial: 0,
      })),
      endedAt: 0,
      phase: training ? "fight" : "intro",
      phaseFrame: 0,
      hitstop: 0,
      winner: -1,
      training,
    };
    if(typeof tournament==='string')initializeElimination(this.state,tournament,seed,()=>this.resetPositions());
    else if(tournament){if(training||teamMatch)throw new Error("Tournament requires free-for-all");this.state.tournament={wins:ids.map(()=>0),round:1,scoredRound:0,withdrawn:[],complete:false,champion:-1,byForfeit:false};}
    if(!training&&!teamMatch&&typeof tournament!=='string')this.state.statistics=newMatchStatistics(ids.length);
    if (training) this.state.fighters.forEach((f) => enter(f, "Idle"));
  }
  private spawnFighters(ids: string[], teams = ids.map((_, i) => i), teamMatch = false): Fighter[] {
    return ids.map((id, i) =>
      Object.assign(fighter(
        id,
        teamMatch ? (teams[i] === 0 ? 300 + teams.slice(0, i).filter(t => t === 0).length * 180 : this.stage.width - 300 - teams.slice(0, i).filter(t => t === 1).length * 180) : ids.length === 2
          ? this.stage.width / 2 + (i ? 200 : -200)
          : Math.round(300 + (i * (this.stage.width - 600)) / (ids.length - 1)),
        (teamMatch ? teams[i] === 0 : i < ids.length / 2) ? 1 : -1,
      ),{y:this.stage.floorHeight}),
    );
  }
  private resolvedTick = -1;
  private resolvedStage?: StageDefinition;
  private get activeStage():StageDefinition {
    const tick=this.state.platformTick??0;
    if(!this.resolvedStage||this.resolvedTick!==tick){this.resolvedTick=tick;this.resolvedStage=stageAtTick(this.stage,tick);}
    return this.resolvedStage;
  }
  private get collisionStage():StageDefinition {
    const roofs=this.state.structures?.filter(b=>b.phase==='built'&&b.kind!=='turret').map(b=>({x:b.x-b.width/2,y:b.y+b.height,width:b.width}));
    return roofs?.length?{...this.activeStage,platforms:[...(this.activeStage.platforms??[]),...roofs]}:this.activeStage;
  }
  snapshot(): SimulationSnapshot {
    return structuredClone(this.state);
  }
  restore(s: SimulationSnapshot): void {
    this.state = structuredClone(s);
    this.resolvedStage=undefined;
    this.clearPresentationEvents();
  }
  resetPositions(): void {
    this.clearPresentationEvents();
    const s = this.state;
    const ids = s.fighters.map((f) => f.characterId);
    s.fighters = this.spawnFighters(ids, s.teams, s.teamMatch);
    s.fighters.forEach((f) => enter(f, "Idle"));
    s.projectiles.forEach((p) => (p.active = false));
    s.hitstop = 0;
    if(s.platformTick!==undefined)s.platformTick=0;
    this.resolvedStage=undefined;
    s.hazards = [];
    s.clones = [];
    delete s.finalDeaths;
    delete s.invasion;
    s.treeDeaths = [];
    s.nextCloneId = 0;
    if(s.structures){s.structures=[];s.nextStructureId=0;}
    if(s.bees){s.bees=[];s.nextBeeId=0;}
    if(s.foreheadWaves)s.foreheadWaves=[];
  }
  emit(type: string, f: Fighter, power = 1, player = 0): void {
    if(isLowProfile(f,this.state.frame))return;
    this.events.push({
      id: `${this.state.frame}:${this.events.length}`,
      type,
      x: f.x,
      y: f.y + 85,
      power,
      player,
    });
  }
  get gameplayEvents(){return gameplayEvents(this.state);}
  clearPresentationEvents():void{this.events=[];clearGameplayEvents(this.state);}
  step(inputs: number[], forfeits: number[] = []): void {
    beginStatisticsFrame(this.state,forfeits);
    clearGameplayEvents(this.state);const finish=observeFrame(this.state);
    advanceTournament(this.state,forfeits,()=>this.resetPositions());
    advanceElimination(this.state,forfeits,()=>this.resetPositions());
    this.advanceFrame(inputs,forfeits);
    scoreTournament(this.state);scoreElimination(this.state);finish();finishStatistics(this.state);
  }
  private advanceFrame(inputs: number[], forfeits: number[]): void {
    const s = this.state;
    this.events = [];
    s.frame++;
    s.phaseFrame++;
    advanceAfterlife(s);
    if (s.phase === "result") return;
    for (const seat of forfeits) {
      const f = s.fighters[seat];
      if (!f || f.lives === 0) continue;
      f.lives = 1;
      f.health = 0;
      f.respawnAt = 0;
    }
    if (forfeits.length) {
      resolveKnockouts(s,false);
      if (this.state.phase === "result") return;
    }
    if (s.phase === "intro") {
      if (s.phaseFrame >= MATCH_INTRO_FRAMES) {
        s.phase = "fight";
        s.phaseFrame = 0;
        s.fighters.forEach((f) => enter(f, "Idle"));
      }
      return;
    }
    advanceInvasionWaves(s,this.stage);
    advancePlatforms(s,this.stage);
    const spawned = advanceRespawns(s,this.stage.floorHeight);
    for (const player of spawned) {
      this.emit("respawn", s.fighters[player], 2, player);
    }
    if (s.training) {
      inputs = [inputs[0], this.dummyInput()];
    }
    for (let i = 0; i < s.fighters.length; i++) {
      const f = s.fighters[i];
      if (!isActive(f)) continue;
      if(!s.hitstop)updateMovementFacing(f,inputs[i],s.frame);
      record(f.buffer, s.frame, inputs[i], f.previousInput, f.facing);
      f.previousInput = inputs[i];
    }
    burstPersonalities(s);
    dropMonsterCookies(s,this.activeStage);
    cleanupJopa(s,this.collisionStage);
    advanceEide(s,this.activeStage);
    s.clones = s.clones.filter(c => c.undead || (isActive(c.fighter)||keepEideNpc(c,s)) && retainsOwnedEntities(s.fighters[c.owner]));
    advanceJopa(s,this.collisionStage,(f,owner)=>{this.emit('impact',f,4,owner);this.emit('landing-dust',f,3,owner);});
    advanceStatuses(s, this.stage.width,this.stage.floorHeight);
    advanceDodo(s,this.stage.floorHeight,this.stage.width);
    advanceJomp(s,this.activeStage,d=>this.emit("impact",d,1,Math.max(0,s.fighters.indexOf(d))));
    advanceFireTrails(s,this.collisionStage);
    advanceGrapples(s,this.stage.floorHeight);
    advanceBlood(s,this.collisionStage);
    advanceFinance(s,this.collisionStage);
    advanceNapa(s,this.activeStage);
    advanceFausto(s);
    advanceAstolfo(s,this.collisionStage);
    advanceAbilityTimers(s);
    advanceStructures(s,this.activeStage);
    advanceNikalz(s,this.collisionStage);
    const returningStarts=new Map(s.projectiles.filter(p=>p.active&&p.trajectory).map(p=>[p,{x:p.x,y:p.y,serial:p.serial}]));
    advanceReturningProjectiles(s,this.activeStage,d=>this.emit("impact",d,1,Math.max(0,s.fighters.indexOf(d))));
    advanceContinuousAttacks(s,d=>this.emit("impact",d,1,Math.max(0,s.fighters.indexOf(d))),this.stage.floorHeight,this.stage.width);
    if (!s.training) {
      for (const player of resolveKnockouts(s)) this.emit("ko", s.fighters[player], 4, player);
      if (this.state.phase === "result") return;
    }
    if (s.hitstop > 0) {
      s.hitstop--;
      return;
    }
    advanceUndead(s,this.collisionStage);
    advanceInvasionBullets(s,this.collisionStage);
    const previousPositions=new Map(actors(s).map(a=>[a.fighter,{x:a.fighter.x,y:a.fighter.y}]));
    for (let i = 0; i < s.fighters.length; i++) {
      const f = s.fighters[i];
      if (!isActive(f) || spawned.includes(i)) continue;
      this.updateFighter(f, inputs[i], i);
    }
    for (let i = 0; i < s.fighters.length; i++)
      for (let j = i + 1; j < s.fighters.length; j++)
        if (
          !spawned.includes(i) &&
          !spawned.includes(j) &&
          isActive(s.fighters[i]) &&
          isActive(s.fighters[j]) &&
          !isFlashDashing(s.fighters[i]) && !isFlashDashing(s.fighters[j])
        )
          pushApart(s.fighters[i], s.fighters[j], this.stage.width);
    // Companions use normal movement and move timing, but only AI basic inputs.
    for (const clone of s.clones) {
      if(clone.undead||clone.fighter.jopaSummon||clone.fighter.loveNpc)continue;
      const input = cloneInput(s, clone, this.activeStage), f = clone.fighter;
      updateMovementFacing(f,input,s.frame);
      record(f.buffer, s.frame, input, f.previousInput, f.facing);
      f.previousInput = input;
      if (isActive(f)) this.updateFighter(f, input, clone.owner);
    }
    for(const [p,from] of returningStarts)if(p.active&&p.serial===from.serial)hitReturningProjectile(s,p,from.x,from.y,d=>this.emit('impact',d,1,Math.max(0,s.fighters.indexOf(d))),previousPositions,this.stage.floorHeight,this.stage.width);
    advanceSpiders(s,this.collisionStage,previousPositions);
    advanceBeams(s,this.stage.width,(a,d,m,source,target)=>this.hit(a,m,target.previousInput,!!target.move,d,source.facing,source,target),this.stage.floorHeight);
    const combatants = actors(s);
    for(let i=0;i<combatants.length;i++) for(let j=i+1;j<combatants.length;j++) {
      const a=combatants[i], b=combatants[j];
      if((a.clone||b.clone)&&isActive(a.fighter)&&isActive(b.fighter)&&!isFlashDashing(a.fighter)&&!isFlashDashing(b.fighter)) pushApart(a.fighter,b.fighter,this.stage.width);
    }
    const structureBlocked=collideStructures(s,previousPositions,this.stage.width);
    attackStructures(s,this.activeStage);
    triggerOrigami(s,this.collisionStage,previousPositions,(...args)=>this.emit(...args));
    const contacts: {attacker: number; defender: number; move: MoveDefinition; projectile?: number}[] = [];
    combatants.forEach((a, attacker) => {
      const f=a.fighter, m=f.move ? characters[f.characterId].moves[f.move] : undefined;
      if (!isActive(f) || !m || (f.connected&&!m.piercing)) return;
      combatants.forEach((d, defender) => {
        if(!f.hitTargets.includes(d.clone?`clone:${d.clone.id}`:`seat:${d.owner}`) && hostile(s,a.owner,d.fighter,d.owner) && (basicMeleeTier(f,m)===null||(d.fighter.x-f.x)*f.facing>=0) && hitboxes(f,m).some(b=>{if(m.flashDash){const old=previousPositions.get(f)??f;const delta=f.x-old.x;return this.hurts(d.fighter,{...b,x:b.x-Math.max(0,delta),w:b.w+Math.abs(delta)});}return this.hurts(d.fighter,b);})) contacts.push({attacker,defender,move:m});
      });
    });
    for (let i=0;i<s.projectiles.length;i++) {
      const p=s.projectiles[i]; if(!p.active || p.trajectory || p.jopaKind) continue;
      const m=characters[s.fighters[p.owner].characterId].moves[p.move], spec=m.projectile,oldX=p.x,oldY=p.y;
      if(spec?.homing) {
        const target=combatants.filter(a=>hostile(s,p.owner,a.fighter,a.owner)&&isActive(a.fighter)&&!isLowProfile(a.fighter,s.frame)).sort((a,b)=>Math.abs(a.fighter.x-p.x)+Math.abs(a.fighter.y+85-p.y)-Math.abs(b.fighter.x-p.x)-Math.abs(b.fighter.y+85-p.y))[0]?.fighter;
        if(target){p.vx=Math.sign(target.x-p.x)*spec.speed;p.y+=Math.max(-8,Math.min(8,target.y+85-p.y));}
      }
      const r=spec?.radius??22;p.x+=p.vx;p.y+=p.vy??0;p.life--;
      if(p.gravity){p.vy=(p.vy??0)-p.gravity;if(p.y-r<=this.stage.floorHeight){if((p.bounces??0)>0){p.y=this.stage.floorHeight+r;p.vy=Math.abs(p.vy)*.75;p.bounces!--;}else {p.active=false;continue;}}}
      if(p.life<=0){p.active=false;continue;}
      if(hitStructureProjectile(s,p,{x:oldX,y:oldY},this.activeStage,previousPositions))continue;
      let defender=-1,earliest=Infinity;
      combatants.forEach((a,index)=>{
        if(!hostile(s,p.owner,a.fighter,a.owner)||!canReceiveDirectHit(a.fighter,s.frame))return;
        const previous=previousPositions.get(a.fighter)??a.fighter;
        const time=Math.min(...targetBoxes(a.fighter,'move').map(box=>sweepEntry(box,oldX+a.fighter.x-previous.x,oldY+a.fighter.y-previous.y,p.x,p.y,r)));
        if(time<earliest){earliest=time;defender=index;}
      });
      if(defender>=0) contacts.push({attacker:p.companionId===undefined?p.owner:(combatants.findIndex(a=>a.clone?.id===p.companionId)<0?p.owner:combatants.findIndex(a=>a.clone?.id===p.companionId)),defender,move:m,projectile:i});
      else if(p.x<0||p.x>this.stage.width)p.active=false;
    }
    const melee=contacts.filter(c=>c.projectile===undefined);
    const counters=combatants.map(a=>isCounterState(a.fighter));
    for(const c of contacts){
      if(c.projectile===undefined&&melee.some(o=>o.attacker===c.defender&&o.defender===c.attacker&&o.move.priority>c.move.priority))continue;
      const a=combatants[c.attacker],d=combatants[c.defender];
      if(c.move.grappleFrames&&a.fighter.state==="Grappling")continue;
      this.hit(a.owner,c.move,d.clone?d.fighter.previousInput:inputs[d.owner],counters[c.defender],d.owner,c.projectile===undefined?a.fighter.facing:Math.sign(s.projectiles[c.projectile].vx),a.fighter,d.fighter,c.projectile!==undefined&&(s.projectiles[c.projectile].owned===true||s.projectiles[c.projectile].companionId!==undefined));
      if(c.move.flashDash)s.hazards.push({kind:"flash-slash",owner:a.owner,x:d.fighter.x,y:d.fighter.y,createdAt:s.frame,expiresAt:s.frame+24,move:c.move.id,nextTicks:[]});
      if(c.projectile!==undefined)s.projectiles[c.projectile].active=false;
      else {a.fighter.connected=true;a.fighter.hitTargets.push(d.clone?`clone:${d.clone.id}`:`seat:${d.owner}`);}
    }
    // Preserve this frame's contacts, then recover charges whose arena edge is
    // unreachable because a solid structure stopped their horizontal movement.
    for(const f of structureBlocked){
      const m=f.move?characters[f.characterId].moves[f.move]:undefined;
      if(m?.arenaRoll&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames)
        f.moveFrame=m.startupFrames+m.activeFrames;
    }
    burstPersonalities(s);
    dropMonsterCookies(s,this.activeStage);
    cleanupJopa(s,this.collisionStage);
    advanceEide(s,this.activeStage);
    s.clones=s.clones.filter(c=>c.undead||(isActive(c.fighter)||keepEideNpc(c,s))&&retainsOwnedEntities(s.fighters[c.owner]));
    for (const f of s.fighters) {
      if (s.training) {
        if (
          !f.stun &&
          !f.burnUntil && !f.poisonUntil && !f.grappleUntil &&
          !s.fighters.some(a=>a!==f&&lightBeam(a,this.stage.width,this.stage.floorHeight)&&beamHitsFighter(lightBeam(a,this.stage.width,this.stage.floorHeight)!,f)) &&
          !(f.move && characters[f.characterId].moves[f.move].channelHeal) &&
          grounded(f,this.collisionStage) &&
          !["Knockdown", "GetUp"].includes(f.state)
        )
          f.health = characters[f.characterId].stats.maxHealth;
        if (this.trainingOptions.infiniteMeter && !energyLocked(f,s.frame)) f.meter = 100;
      }
    }
    if (!s.training) {
      for (const player of resolveKnockouts(s))
        this.emit("ko", s.fighters[player], 4, player);
    }
  }

  hurts(
    d: Fighter,
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    if (
      !canReceiveDirectHit(d,this.state.frame)
    )
      return false;
    const boxes=targetBoxes(d,'move');
    return boxes.some((h) => intersects(b, h));
  }
  dummyInput(): number {
    const f = this.state.fighters[1];
    const opponent=actors(this.state).filter(a=>a.owner!==1&&isActive(a.fighter)).sort((a,b)=>Math.abs(a.fighter.x-f.x)-Math.abs(b.fighter.x-f.x))[0]?.fighter;
    const back = opponent&&opponent.x<f.x ? Button.Right : Button.Left;
    switch (this.trainingOptions.dummy) {
      case "crouch":
        return Button.Down;
      case "jump":
        return Button.Up;
      case "block":
        return back | Button.Down;
      case "afterHit":
        return f.combo > 0 ? back : 0;
      default:
        return 0;
    }
  }
  updateFighter(f: Fighter, input: number, player: number): void {
    const base = characters[f.characterId];
    const def = f.cookieBoss ? {...base,stats:{...base.stats,walkSpeed:1.8,backwardSpeed:1.8,jumpVelocity:0}} : base;
    const companionSpeed=f.companionVariant!==undefined&&base.companionStyle==='basketball'?.85:1;
    const basics = basicAttacks(def,f);
    const boosted = f.onFireUntil > this.state.frame;
    const speed = companionSpeed*(inLove(f)?EIDE.loveSpeed:1)*personalityMovementSpeed(f)*angerMultiplier(f,this.state.frame)*movementSlow(f,this.state.frame)*(boosted ? 1.5 : 1)*(f.weaponUntil ? def.weaponModifiers?.speed??1 : 1);
    f.stateFrame++;
    if(sniffSuppresses(this.state,f)){f.buffer=[];input&=Button.Left|Button.Right|Button.Up|Button.Down;}
    if(controlMeteor(this.state,this.collisionStage,f,player))return;
    if(controlJopa(this.state,this.collisionStage,f,player))return;
    if(coolMuscles(f)||gymHolding(f)&&f.moveFrame>=18)return;
    if(f.grappleUntil>0 && f.grappleUntil>=this.state.frame || f.state==="Grappling")return;
    if (f.trappedUntil > this.state.frame) {
      f.move=null; f.vx=f.vy=0; f.stun=0; f.buffer=[];
      enter(f,"HairTrapped"); return;
    }
    if (f.state === "HairTrapped") { f.trappedUntil=0; f.buffer=[]; enter(f, grounded(f,this.collisionStage)?"Idle":"Fall"); }

    if (grounded(f,this.collisionStage)) { f.airJumpUsed = false; f.airJumpsUsed = 0; }
    const jumpPressed = !flying(f,this.state.frame) && !!((f.buffer.at(-1)?.pressed ?? 0) & Button.Up);
    if (
      jumpPressed &&
      !grounded(f,this.collisionStage) &&
      f.airJumpsUsed < (f.weaponUntil>this.state.frame?def.weaponModifiers?.airJumps??def.maxAirJumps??1:def.maxAirJumps??1) &&
      (!f.move || !!def.moves[f.move].holdInvisible || !!def.moves[f.move].talking) &&
      !locked(f) &&
      (["Jump", "Fall"].includes(f.state) || !!(f.move&&(def.moves[f.move].holdInvisible||def.moves[f.move].talking)))
    ) {
      f.airJumpUsed = true;
      f.airJumpsUsed++;
      f.vy = def.stats.jumpVelocity;
      const horizontal =
        (input & Button.Right ? 1 : 0) - (input & Button.Left ? 1 : 0);
      if (horizontal) f.vx = horizontal * 4;
      enter(f, "Jump");
      this.emit(f.airJumpsUsed===2 ? "blood-jump" : "dust", f, 2, player);
    }
    if (f.stun > 0) {
      f.stun--;
      if(f.timedHitReaction){if(--f.timedHitReaction===0)delete f.timedHitReaction;}
      if(!f.stun)f.dazed=false;
      // Airborne movement is integrated once below, alongside gravity.
      if (grounded(f,this.collisionStage)) f.x += f.vx;
      f.vx = Math.trunc((f.vx * 8) / 10);
      if (!f.stun) {
        if (!grounded(f,this.collisionStage)) {
          if (f.state !== "AirHitStun" || flying(f,this.state.frame)) enter(f, "Fall");
        } else if (f.state === "AirHitStun") enter(f, "Knockdown");
        else enter(f, "Idle");
      }
    } else if (f.state === "AirHitStun") {
      /* Remain vulnerable in the air until landing. */
    } else if (f.state === "Knockdown") {
      if (f.stateFrame >= 32) enter(f, "GetUp");
    } else if (f.state === "GetUp") {
      if (f.stateFrame >= 18) enter(f, "Idle");
    } else if (f.state === "JumpStartup") {
      if (f.stateFrame >= 3) {
        f.vy = def.stats.jumpVelocity;
        f.y += 1;
        enter(f, "Jump");
        this.emit("dust", f, 1, player);
      }
    } else if (f.state === "Land") {
      if (f.stateFrame >= 3) enter(f, "Idle");
    } else {
      const invisible = f.move ? def.moves[f.move].holdInvisible : undefined;
      if (invisible && !(input & invisible)) { f.move=null; consumeButtons(f.buffer); enter(f,grounded(f,this.collisionStage)?"Idle":"Fall"); }
      const channel = f.move ? def.moves[f.move].channelHeal : undefined;
      if (channel && (!(input & channel.button) || !grounded(f,this.collisionStage))) {
        f.move = null;
        consumeButtons(f.buffer);
        enter(f, grounded(f,this.collisionStage) ? (input & Button.Down ? "Crouch" : "Idle") : "Fall");
      }
      const request = f.cookieBoss ? null : this.requestMove(f, input);
      const current = f.move ? def.moves[f.move] : undefined;
      if (
        request &&
        (!current ||
          ((f.move !== null && basics.chain.indexOf(f.move)>=0 && basics.chain[basics.chain.indexOf(f.move)+1]===request) &&
            f.moveFrame >= current.startupFrames + current.activeFrames + 3) ||
          (f.connected &&
            f.moveFrame >= current.cancelFrame &&
            current.cancelRules.includes(request)))
      ) {
        const m = def.moves[request];
        const superMove = def.superButtons.includes(request);
        const cost = superMove ? 100 : m?.meterCost;
        if (
          m && allowsMove(f,m) &&
          (!energyLocked(f,this.state.frame) || !(superMove || def.specialButtons.includes(request) || def.superButtons.some(id=>def.moves[id].reactivation===request) || m.meterCost > 0)) &&
          (!characters[f.characterId].muscleFighter||request!=="gymBro"||gymTarget(this.state,f)>=0) &&
          (!m.origamiTrap || this.state.hazards.filter(h=>h.kind==='origami'&&h.owner===player).length<FAUSTO.trapLimit) &&
          (!m.returningProjectile || canSpawnReturningProjectile(this.state,player,m.returningProjectile)) &&
          (!m.talking || !!(input & Button.Special)) &&
          (!m.channelHeal || (!!(input & m.channelHeal.button) && grounded(f,this.collisionStage))) &&
          cost !== undefined &&
          f.meter >= cost &&
          (!superMove || !f.usedSupers.includes(request))
        ) {
          f.beamAim=m.beam?.initialAim??0;
          if (f.actionUntil) f.actionUntil = 0;
          f.move = request;
          if(m.eideAbility==='seller'||m.eideAbility==='bahia')f.applianceVariant=nextAppliance(f,this.state.frame,player);
          startFinanceMove(f,m);
          f.moveFrame = -1;
          if(m.chargeFrames){f.chargeStartedAt=this.state.frame;f.chargeButton=input&(Button.Light|Button.Medium|Button.Heavy);}
          lowProfileMove(f,this.state.frame);
          startJomp(this.state,f);
          f.speedRemainder = 0;
          f.connected = false;
          f.projectileSpawned = false;
          f.attackSerial++;
          f.hitTargets=[];
          spendEnergy(this.state,f,cost);
          if(superMove)trackActivation(this.state,f,'ultimates');
          else if(def.specialButtons.includes(request)||def.specialMoves.some(v=>v.move===request))trackActivation(this.state,f,'specials');
          if (superMove) f.usedSupers.push(request);
          enter(f, m.state);
          consumeButtons(f.buffer);
          this.emit(
            superMove ? "super" : "attack",
            f,
            superMove ? 5 : 1,
            player,
          );
        }
      }
      if (f.move) {
        const m = def.moves[f.move];
        // Releasing a held beam cancels both charge and active emission immediately.
        // Recovery remains non-cancellable, so a fresh press cannot resume an old charge.
        if(m.beam?.holdButton && !(input & m.beam.holdButton) && f.moveFrame<m.startupFrames+m.activeFrames){
          f.moveFrame=m.startupFrames+m.activeFrames;
          consumeButtons(f.buffer);
        }
        if(m.chargeFrames && f.moveFrame<m.startupFrames && !(input&(f.chargeButton??0))){f.moveFrame=m.startupFrames+m.activeFrames;consumeButtons(f.buffer);}
        if(m.suction?.holdButton&&f.moveFrame>=m.startupFrames&&f.moveFrame<m.startupFrames+m.activeFrames){
          if(!(input&m.suction.holdButton)||f.meter<=0)f.moveFrame=m.startupFrames+m.activeFrames;
          else {
            if(f.stateFrame%(m.suction.drainInterval??36)===0)spendEnergy(this.state,f,m.suction.drainAmount??5);
            if(f.meter<=0)f.moveFrame=m.startupFrames+m.activeFrames;
            else f.moveFrame=m.startupFrames;
          }
        }
        const previousFrame = f.moveFrame;
        f.speedRemainder += m.channelHeal ? 100 : Math.round(companionSpeed*personalitySpeed(f)*(boosted ? 150 : 100)*(f.weaponUntil>this.state.frame?def.weaponModifiers?.attackSpeed??1:1)*attackSlow(f,this.state.frame)*angerMultiplier(f,this.state.frame));
        const advance = Math.floor(f.speedRemainder / 100);
        f.speedRemainder %= 100;
        f.moveFrame += advance;
        if(m.chargeFrames&&previousFrame<m.startupFrames)f.moveFrame=this.state.frame-(f.chargeStartedAt??this.state.frame);
        advanceBasicMelee(this.state,f,m,previousFrame,this.collisionStage);
        if(coolMuscles(f)){f.moveFrame=0;f.vx=f.vy=0;return;}
        if(gymHolding(f)&&f.moveFrame>=18){f.moveFrame=18;return;}
        if(m.talking){
          const horizontal=(input&Button.Right?1:0)-(input&Button.Left?1:0);
          if(!grounded(f,this.collisionStage))f.vx=horizontal*def.stats.walkSpeed;
          else if(jumpPressed){f.vx=horizontal*def.stats.walkSpeed;f.vy=def.stats.jumpVelocity;f.y+=1;}
        }
        if (m.mobile && grounded(f,this.collisionStage)) {
          const horizontal=(input&Button.Right?1:0)-(input&Button.Left?1:0);
          f.x+=horizontal*def.stats.walkSpeed*speed;
        }
        if (m.holdInvisible && grounded(f,this.collisionStage)) {
          const horizontal=(input & Button.Right ? 1 : 0)-(input & Button.Left ? 1 : 0);
          f.x+=horizontal*(horizontal===f.facing?def.stats.walkSpeed:def.stats.backwardSpeed)*speed;
          if(jumpPressed){f.vx=horizontal*4;f.vy=def.stats.jumpVelocity;f.y+=1;}
        }
        if (m.channelHeal) {
          f.vx = f.vy = 0;
          if ((f.moveFrame + 1) % m.channelHeal.interval === 0) {
            healTo(this.state,f,Math.min(def.stats.maxHealth, f.health + m.channelHeal.amount));
            this.emit("heal", f, 1, player);
          }
        }
        if (m.dive && f.moveFrame >= m.startupFrames && f.moveFrame <= m.startupFrames + m.activeFrames && !grounded(f,this.collisionStage)) {
          f.moveFrame = m.startupFrames;
          f.vy = -m.dive.speed;
          f.vx = m.dive.drift * f.facing;
        }
        if(m.arenaRoll&&f.moveFrame>=m.startupFrames&&f.moveFrame<=m.startupFrames+m.activeFrames){
          const edge=f.facing===1?this.stage.width-40:40;
          if(Math.abs(f.x-edge)>(m.advance??0))f.moveFrame=m.startupFrames;
          else {f.x=edge;f.moveFrame=m.startupFrames+m.activeFrames;}
        }
        if(m.beam?.steerable){
          const aim=f.beamAim+((input&Button.Up?1:0)-(input&Button.Down?1:0));
          f.beamAim=m.beam.fullCircle?((aim+180+360)%360)-180:Math.max(-70,Math.min(70,aim));
        }
        const activates = frameCrossed(previousFrame,f.moveFrame,m.startupFrames);
        if(activates&&m.beam?.float){f.y+=m.beam.float;f.vx=f.vy=0;}
        if(activates)activateNikalz(this.state,this.collisionStage,f,player,m);
        if(f.meteorStart!==undefined)return;
        if(activates)activateEide(this.state,this.collisionStage,f,player,m);
        if(activates)activateFinance(this.state,this.collisionStage,f,player,m);
        if(activates)activateStructure(this.state,this.activeStage,f,player,m);
        if(activates)activateAstolfo(this.state,this.collisionStage,f,player,m);
        if(activates)activateFausto(this.state,this.collisionStage,f,player,m);
        if(activates)activateJopa(this.state,this.collisionStage,f,player,m);
        if(f.jopaTree!==undefined||f.jopaRide!==undefined)return;
        if(activates)activateNapa(this.state,this.collisionStage,f,player,m);
        if(activates)activateTimedMove(f,this.state.frame,m);
        if(f.actionUntil&&this.state.frame<f.actionUntil&&m.durationClock==='simulation')f.moveFrame=Math.min(f.moveFrame,m.startupFrames+m.activeFrames-1);
        if (activates && m.returningProjectile) spawnReturningProjectile(this.state,player,m.id,m.returningProjectile);
        if (activates) activateBlood(this.state,this.activeStage,f,player,m);
        if (activates && m.extraLife) f.lives++;
        if (activates && m.weaponFrames) f.weaponUntil=this.state.frame+m.weaponFrames;
        if (activates && m.armorFrames) f.armorUntil = this.state.frame + m.armorFrames;
        if (activates && m.summonClones) summonClones(this.state, player, this.activeStage);
        if (activates && m.auraFrames) f.onFireUntil = this.state.frame + m.auraFrames;
        if (m.hazard && frameCrossed(previousFrame,f.moveFrame,m.hazard.startFrame??m.startupFrames) && this.state.hazards.filter(h=>!h.kind).length < Math.max(48, this.state.fighters.length * 8)) {
          // Capacity scales to cover all boosted casters while every sigil keeps its full lifetime.
          this.state.hazards.push({owner: player, x: f.x, y: surfaceBelow(this.collisionStage, f.x, f.y), expiresAt: this.state.frame + m.hazard.duration, move: m.id, nextTicks: this.state.fighters.map(() => this.state.frame + 1)});
        }
        for (const event of m.events)
          if (event.frame > previousFrame && event.frame <= f.moveFrame) this.emit(event.id, f, 1, player);
        if (
          m.advance &&
          f.moveFrame >= m.startupFrames &&
          f.moveFrame < m.startupFrames + m.activeFrames
        )
          f.x += m.advance * f.facing * speed;
        if (m.selfLaunch && activates) {
          f.vy = m.selfLaunch;
          f.y += 1;
        }
        if (
          m.projectile &&
          activates &&
          !f.projectileSpawned
        ) {
          const directions=m.projectile.cardinal?[[f.facing,0],[0,1],[-f.facing,0],[0,-1]]:[[f.facing,0]];
          for(const [dx,dy] of directions){
          const slot = this.state.projectiles.find((p) => !p.active);
          if (slot) {
            initializeProjectile(slot, {
              ...(m.projectile.variants?{variant:(f.productIndex??0)%m.projectile.variants}:{}),
              ...(f.companionVariant!==undefined?{companionId:this.state.clones.find(c=>c.fighter===f)?.id}:{}),
              trajectory: undefined,
              active: true,
              owner: player,
              x: f.x + dx * (m.projectile.originX ?? 70),
              y: f.y + (m.projectile.originY ?? (m.projectile.visual === "pentagram" ? 165 : 100)),
              vx: m.projectile.speed * dx,
              vy: m.projectile.speed * dy,
              life: m.projectile.arenaRange?Math.ceil((this.stage.width+2*(m.projectile.radius??22))/m.projectile.speed)+1:m.projectile.lifetime,
              move: m.id,
              serial: f.attackSerial,
            });
          }
          }
          if(m.projectile.variants)f.productIndex=((f.productIndex??0)+1)%m.projectile.variants;
          f.projectileSpawned = true;
          this.emit(m.projectile.visual==='sound'?"metal":"projectile", f, 2, player);
        }
        if (
          !m.channelHeal && !m.holdInvisible && f.moveFrame >=
          m.startupFrames + m.activeFrames + m.recoveryFrames
        ) {
          f.move = null;
          enter(f, grounded(f,this.collisionStage) ? (input & Button.Down ? "Crouch" : "Idle") : "Fall");
        }
      } else if (grounded(f,this.collisionStage) && !locked(f)) {
        f.combo = 0;
        f.comboDamage = 0;
        const dir = direction(input, f.facing);
        if (f.y > this.collisionStage.floorHeight && doubleTapDown(f.buffer)) {
          // Start below this one-way surface so lower platforms still catch the fall.
          f.y -= 1;
          f.vy = -1;
          f.vx = 0;
          enter(f, "Fall");
        } else if (input & Button.Up) {
          f.vx = (input & Button.Right ? 4 : 0) - (input & Button.Left ? 4 : 0);
          enter(f, "JumpStartup");
        } else if (
          ["DashForward", "DashBackward"].includes(f.state) &&
          f.stateFrame < 12
        ) {
          f.x += f.facing * (f.state === "DashForward" ? 11 : -9) * 1.3 * speed * (inLove(f)?EIDE.loveDash/EIDE.loveSpeed:1) * (def.dashMultiplier ?? 1) * (f.weaponUntil>this.state.frame?def.weaponModifiers?.dash??1:1);
        } else if (doubleTapHorizontal(f.buffer, Button.Right) || doubleTapHorizontal(f.buffer, Button.Left)) {
          enter(f, "DashForward");
          this.emit("dash-dust", f, 1, player);
        } else if (input & Button.Down) {
          enter(f, "Crouch");
        } else if (dir === 6 || dir === 4) {
          const forward = dir === 6;
          enter(f, forward ? "WalkForward" : "WalkBackward");
          f.x +=
            f.facing *
            (forward ? def.stats.walkSpeed : -def.stats.backwardSpeed) * speed;
        } else enter(f, "Idle");
      }
    }
    if(controlFlight(this.state,this.collisionStage,f,input,speed))return;
    if (!grounded(f,this.collisionStage) && !(f.move&&def.moves[f.move].beam?.float) && !(f.stun&&f.state==='HitStunStanding'&&f.lastDamage>0)) {
      const previousY = f.y;
      f.x += f.vx * (f.stun || f.state === "AirHitStun" ? 1 : speed);
      const verticalSpeed = f.stun ? 1 : movementSlow(f,this.state.frame);
      f.y += f.vy * verticalSpeed;
      f.vy -= def.stats.gravity * verticalSpeed;
      const surface = surfaceBelow(this.collisionStage, f.x, previousY);
      if (f.vy <= 0 && f.y <= surface) {
        f.y = surface;
        f.airJumpUsed = false;
        f.airJumpsUsed = 0;
        f.vy = 0;
        f.vx = 0;
        if (
          f.state === "AirHitStun" ||
          (f.stun > 0 && f.state.includes("HitStun"))
        ) {
          f.move = null;
          if(f.gymLandingStun){f.gymLandingStun=false;f.gymStunnedUntil=this.state.frame+JOMP.landingStun;f.stun=JOMP.landingStun;f.dazed=true;enter(f,'HitStunStanding');}
          else{f.stun=0;f.dazed=false;enter(f, "Knockdown");}
        } else if (f.move && def.moves[f.move].dive) {
          const m=def.moves[f.move];
          recordGameplayEvent(this.state,'GroundImpact',player,m.id);
          f.moveFrame=m.startupFrames+m.activeFrames;
        } else if (!f.move) enter(f, "Land");
        // A throw landing effect belongs to this flight, including a combo escape.
        if(f.gymLandingStun)f.gymLandingStun=false;
        this.emit("landing-dust", f, 1, player);
      } else if (
        f.vy <= 0 &&
        !f.move &&
        !f.stun &&
        !["AirHitStun", "Knockdown", "GetUp"].includes(f.state)
      )
        enter(f, "Fall");
    }
    f.x = Math.max(40, Math.min(this.stage.width - 40, Math.round(f.x * 10) / 10));
    def.states[f.state]?.(f, this.state.frame);
  }
  requestMove(f: Fighter, input: number): string | null {
    const frame = this.state.frame,
      def = characters[f.characterId];
    if(sniffSuppresses(this.state,f))return null;
    const nikalz=nikalzRequest(f,frame);if(nikalz!==undefined)return nikalz;
    const finance=financeRequest(f,frame);if(finance!==undefined)return finance;
    const basics = basicAttacks(def,f);
    if((f.modeFinaleUntil??0)>frame)return null;
    if(characters[f.characterId].musicFighter&&f.weaponUntil>frame&&[Button.Light,Button.Medium,Button.Heavy].some(b=>bufferedButton(f.buffer,frame,b)))return 'starWave';
    const basicsOnly=!!f.weaponUntil&&def.weaponModifiers?.basicsOnly;
    if (!basicsOnly && bufferedButton(f.buffer, frame, Button.Super2))
      return def.moves[def.superButtons[1]].reactivation&&markedStructure(this.state,this.state.fighters.indexOf(f),def.superButtons[1])?def.moves[def.superButtons[1]].reactivation!:def.superButtons[1];
    if (!basicsOnly && bufferedButton(f.buffer, frame, Button.Super1))
      return def.superButtons[0];
    // A fresh repeat press can queue one follow-up during the current chain move.
    // Consuming presses at move start prevents holding a button from auto-chaining.
    const chainPress = (f.move !== null && basics.chain.slice(0,-1).includes(f.move)) &&
      f.buffer.some(sample => frame - sample.frame <= 32 && !!(sample.pressed & Button.Light));
    const attack = chainPress || [Button.Light, Button.Medium, Button.Heavy].some((b) =>
      bufferedButton(f.buffer, frame, b),
    );
    if (attack && !basicsOnly && f.companionVariant===undefined) {
      for (const special of def.specialMoves)
        if (motion(f.buffer, special.motion)) return special.move;
    }
    if (!basicsOnly && bufferedButton(f.buffer, frame, Button.Special2))
      return def.specialButtons[1];
    if (!basicsOnly && bufferedButton(f.buffer, frame, Button.Special))
      return def.specialButtons[0];
    if (!attack) return null;
    if(f.returningWeaponOut&&!f.weaponUntil)return null;
    if (def.moves[basics.heavy].holdInvisible && bufferedButton(f.buffer,frame,Button.Medium)) return basics.heavy;
    if (def.modeDirectInputs && f.weaponUntil) {
      if(bufferedButton(f.buffer,frame,Button.Medium))return basics.heavy;
      if(bufferedButton(f.buffer,frame,Button.Heavy))return basics.kick;
      return basics.chain[0];
    }
    if (!grounded(f,this.collisionStage)) {
      if(f.airJumpUsed && basics.doubleJumpHeavy && bufferedButton(f.buffer,frame,Button.Medium))return basics.doubleJumpHeavy;
      return basics.air;
    }
    if (input & Button.Down) return basics.crouch;
    if (bufferedButton(f.buffer, frame, Button.Medium)) return basics.heavy;
    if (bufferedButton(f.buffer, frame, Button.Heavy)) return basics.kick;
    const chainIndex=f.move===null?-1:basics.chain.indexOf(f.move);
    if(chainIndex>=0&&chainIndex<basics.chain.length-1)return basics.chain[chainIndex+1];
    return basics.chain[0];
  }
  hit(
    attacker: number,
    m: MoveDefinition,
    input: number,
    counter: boolean,
    defender = 1 - attacker,
    impactDirection: number = this.state.fighters[attacker].facing,
    source?: Fighter,
    target?: Fighter,
    sourceOwned=false,
  ): void {
    resolveHit(this.state,this.collisionStage,(...args)=>this.emit(...args),attacker,m,input,counter,defender,impactDirection,source,target,sourceOwned);
  }
}
export function hashState(s: SimulationSnapshot): string {
  const text = JSON.stringify(s);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
