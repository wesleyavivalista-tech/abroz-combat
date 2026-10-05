import type { Championship } from "../game-core/tournament/Championship.js";
export type OnlineMode = "championship" | "ffa" | "ffa-tournament" | "elimination" | "elimination-party" | "2v2" | "3v3";
export const PROTOCOL_VERSION = 45;
export type ClientMessage =
  | {type:"finished";frame:number}
  | { type: "create"; stage?: string; character: string; capacity?: number; mode?: OnlineMode; team?: number; skin?: string }
  | { type: "join"; code: string; character: string; team?: number; skin?: string }
  | { type: "ready" }
  | { type: "championship-ready"; matchId: string }
  | { type: "input"; matchId?: string; frame: number; mask: number }
  | { type: "hash"; matchId?: string; frame: number; hash: string }
  | { type: "ping"; sent: number };
export type ServerMessage =
  | { type: "championship"; bracket: Championship; ready: number[] }
  | { type: "championship-start"; stage?: string; matchId: string; seat: number; characters: string[]; skins: string[] }
  | {type:"input-wait";seat:number;seconds:number}
  | {
      type: "roster";
      stage?: string;
      capacity: number;
      mode: OnlineMode;
      players: { character: string; ready: boolean; team: number; skin: string }[];
    }
  | { type: "room"; code: string; seat: number }
  | {
      type: "start";
      stage?: string;
      seed?: number;
      characters: string[];
      teams: number[];
      skins: string[];
      mode: OnlineMode;
      inputDelay: number;
      maxRollbackFrames: number;
    }
  | { type: "input"; matchId?: string; seat: number; frame: number; mask: number }
  | { type: "hash"; matchId?: string; seat: number; frame: number; hash: string }
  | { type: "pong"; sent: number }
  | { type: "error"; message: string }
  | { type: "left"; seat: number; frame: number };
