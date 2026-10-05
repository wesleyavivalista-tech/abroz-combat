import {trainingRoom} from "../../../packages/game-core/stages/registry.js";
import type { WebSocket } from 'ws';
import { GameSimulation } from '../../../packages/game-core/simulation/GameSimulation.js';
import { createChampionship, currentMatches, finishBracketMatch, findMatch, matchToken, startBracketMatch, withdrawEntrant, type Entrant } from '../../../packages/game-core/tournament/Championship.js';
import type { ServerMessage } from '../../../packages/shared/protocol.js';
interface Participant { socket: WebSocket; character: string; skin: string; connected: boolean }
interface Duel {
  simulation: GameSimulation; players: [number, number]; token: string;
  inputs: [Map<number, number>, Map<number, number>]; last: [number, number]; progress: [number, number];
}
/** Tournament seats never change. Duel seats and packets are scoped to one match attempt. */
export class ChampionshipSession {
  bracket;
  ready = new Set<number>();
  duels = new Map<string, Duel>();
  private awaiting = new Map<number, number>();
  constructor(private peers: Participant[], private send: (socket: WebSocket, message: ServerMessage) => void, private stage = trainingRoom) {
    const entrants: Entrant[] = peers.map((p, id) => ({ id, name: `Player ${id + 1}`, character: p.character, skin: p.skin }));
    this.bracket = createChampionship(entrants);
    this.publish();
  }
  acknowledge(socket: WebSocket, token: string): void {
    const id = this.peers.findIndex(p => p.socket === socket && p.connected);
    const m = currentMatches(this.bracket).find(m => matchToken(m) === token && m.status === 'ready' && m.slots.includes(id));
    if (!m || id < 0) return;
    this.ready.add(id);
    if (m.slots.every(n => n !== null && this.ready.has(n))) {
      startBracketMatch(this.bracket, m.id);
      const players = m.slots as [number, number];
      const chars = players.map(n => this.peers[n].character), skins = players.map(n => this.peers[n].skin);
      const simulation = new GameSimulation(chars, false, this.stage, undefined, skins);
      simulation.step([0, 0]); simulation.step([0, 0]);
      this.duels.set(m.id, { simulation, players, token, inputs: [new Map(), new Map()], last: [1, 1], progress: [Date.now(), Date.now()] });
      players.forEach((n, seat) => { this.ready.delete(n); this.awaiting.delete(n); this.send(this.peers[n].socket, { type: 'championship-start', stage: this.stage.id, matchId: token, seat, characters: chars, skins }); });
    }
    this.publish();
  }
  input(socket: WebSocket, token: string | undefined, frame: number, mask: number): void {
    const found = this.duelFor(socket, token);
    if (!found) return; // Late packets from an ended duel cannot affect the next match.
    const { duel, seat, id } = found;
    if (!Number.isInteger(frame) || frame < 2 || frame > 10_000_000 || !Number.isInteger(mask) || mask < 0 || mask > 2047) throw new Error('Invalid input');
    if (frame !== duel.last[seat] + 1 || frame > duel.last[1 - seat] + 120) throw new Error('Out-of-order input');
    duel.last[seat] = frame; duel.progress[seat] = Date.now(); duel.inputs[seat].set(frame, mask);
    this.send(this.peers[duel.players[1 - seat]].socket, { type: 'input', matchId: token, seat, frame, mask });
    while (duel.inputs.every(queue => queue.has(duel.simulation.state.frame))) {
      const f = duel.simulation.state.frame;
      duel.simulation.step(duel.inputs.map(queue => queue.get(f)!));
      duel.inputs.forEach(queue => queue.delete(f));
      if (duel.simulation.state.phase === 'result') {
        const winner = duel.simulation.state.winner;
        finishBracketMatch(this.bracket, id, winner < 0 ? null : duel.players[winner]);
        this.duels.delete(id); this.publish(); return;
      }
    }
  }
  hash(socket: WebSocket, token: string | undefined, frame: number, hash: string): void {
    const found = this.duelFor(socket, token);
    if (!found || !Number.isInteger(frame) || frame < 0 || frame > found.duel.last[found.seat] || frame % 60 !== 0 || !/^[a-f0-9]{1,8}$/.test(hash)) return;
    this.send(this.peers[found.duel.players[1 - found.seat]].socket, { type: 'hash', matchId: token, seat: found.seat, frame, hash });
  }
  leave(socket: WebSocket): void {
    const id = this.peers.findIndex(p => p.socket === socket);
    this.ready.delete(id); this.awaiting.delete(id); withdrawEntrant(this.bracket, id);
    for (const [key] of this.duels) if (findMatch(this.bracket, key)?.status !== 'playing') this.duels.delete(key);
    this.publish();
  }
  /** Waiting spectators never time out. Only unready or input-stalling contestants forfeit. */
  expired(now: number): WebSocket[] {
    const expired = new Set<number>();
    for (const [id, since] of this.awaiting) if (!this.ready.has(id) && now - since >= 120_000) expired.add(id);
    for (const duel of this.duels.values()) {
      const min = Math.min(...duel.last);
      duel.players.forEach((id, seat) => { if (duel.last[seat] === min && now - duel.progress[seat] >= (min === 1 ? 120_000 : 60_000)) expired.add(id); });
    }
    return [...expired].map(id => this.peers[id].socket);
  }
  private duelFor(socket: WebSocket, token: string | undefined) {
    for (const [id, duel] of this.duels) {
      const seat = duel.players.findIndex(n => this.peers[n].socket === socket && this.peers[n].connected);
      if (duel.token === token && seat >= 0) return { id, duel, seat };
    }
  }
  private publish(): void {
    const waiting = new Set(currentMatches(this.bracket).filter(m => m.status === 'ready').flatMap(m => m.slots).filter((id): id is number => id !== null));
    for (const id of this.awaiting.keys()) if (!waiting.has(id)) this.awaiting.delete(id);
    for (const id of waiting) if (!this.awaiting.has(id)) this.awaiting.set(id, Date.now());
    for (const id of this.ready) if (!waiting.has(id)) this.ready.delete(id);
    this.peers.filter(p => p.connected).forEach(p => this.send(p.socket, { type: 'championship', bracket: this.bracket, ready: [...this.ready] }));
  }
}
