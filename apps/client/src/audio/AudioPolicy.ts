import type {SoundDefinition} from './SoundRegistry.js';
export interface VoiceInfo { id: number; key: string; priority: number; started: number; }
/** Pure admission policy, independent of Web Audio and simulation. */
export class AudioPolicy {
  readonly voices = new Map<number, VoiceInfo>();
  readonly seen = new Set<string>();
  private last = new Map<string, number>();
  private serial = 0;
  suppressed = 0;
  constructor(readonly cap = 24) {}
  admit(key: string, def: SoundDefinition, now: number, eventId?: string): {id: number; evict?: number} | undefined {
    if (eventId && this.seen.has(eventId)) { this.suppressed++; return; }
    if (eventId) {
      this.seen.add(eventId);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
    }
    if (now - (this.last.get(key) ?? -Infinity) < def.cooldown) { this.suppressed++; return; }
    const all = [...this.voices.values()], same = all.filter(v => v.key === key);
    let victim: VoiceInfo | undefined;
    if (def.loop && same.length >= def.maxInstances) { this.suppressed++; return; }
    if (same.length >= def.maxInstances) victim = same.sort((a,b) => a.started-b.started)[0];
    else if (all.length >= this.cap) {
      victim = all.sort((a,b) => a.priority-b.priority || a.started-b.started)[0];
      if (victim.priority >= def.priority) { this.suppressed++; return; }
    }
    if (victim) this.voices.delete(victim.id);
    const id = ++this.serial;
    this.voices.set(id, {id, key, priority: def.priority, started: now});
    this.last.set(key, now);
    return {id, evict: victim?.id};
  }
  reset(): void { this.voices.clear(); this.seen.clear(); this.last.clear(); }
}
