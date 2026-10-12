import type { Championship } from "../game-core/tournament/Championship.js";
export type OnlineMode = "championship" | "ffa" | "ffa-tournament" | "elimination" | "elimination-party" | "2v2" | "3v3";
export const PROTOCOL_VERSION = 49;
export interface RoomSettings { name?:string; visibility?:"public"|"private"; stage?:string; capacity?:number; mode?:OnlineMode }
export interface RoomSummary { code:string; name:string; capacity:number; count:number; mode:OnlineMode; status:"waiting"|"full"|"playing" }
export interface RoomView extends RoomSummary { owner:number; seat:number; stage:string; visibility:"public"|"private"; startReason:string; players:{character:string;skin:string;team:number;ready:boolean;connected:boolean;status:"lobby"|"results"|"reconnecting"|"left"}[] }
export type ClientMessage =
  | {type:"spectate";matchId?:string}
  | {type:"list-rooms"}
  | {type:"room-settings";settings:RoomSettings}
  | {type:"choose-fighter";character:string;skin?:string}
  | {type:"start-match"}

  | {type:"resume";token:string}
  | {type:"leave"}
  | {type:"finished";frame:number;matchId?:string}
  | {type:"restart-fight";matchId?:string}
  | {type:"return-room";matchId?:string}
  | { type: "create"; name?:string; visibility?:"public"|"private"; stage?: string; character: string; capacity?: number; mode?: OnlineMode; team?: number; skin?: string }
  | { type: "join"; code: string; character: string; team?: number; skin?: string }
  | { type: "ready"; ready?:boolean }
  | { type: "championship-ready"; matchId: string }
  | { type: "input"; matchId?: string; frame: number; mask: number }
  | { type: "hash"; matchId?: string; frame: number; hash: string }
  | { type: "ping"; sent: number };
export type ServerMessage =
  | {type:"spectate-start";matchId:string;stage:string;state:import("./recovery.js").RecoveryState}
  | {type:"rooms";rooms:RoomSummary[]}
  | {type:"room-state";room:RoomView}

  | {type:"match-statistics";matchId?:string;statistics:import("../game-core/simulation/MatchStatistics.js").MatchStatistics}
  | {type:"room-return-status";matchId?:string;ready:number;total:number}
  | {type:"room-returned";code:string;seat:number}

  | {type:"fight-restarted";previousId?:string;matchId:string;seat:number;stage:string;mode:OnlineMode;state:import("./recovery.js").RecoveryState;bracket?:Championship}
  | {type:"restart-denied"}

  | {type:"resume-token";token:string}
  | {type:"resume";seat:number;stage:string;mode:OnlineMode;matchId?:string;bracket?:Championship;ready?:number[];state?:import("./recovery.js").RecoveryState}

  | { type: "championship"; bracket: Championship; ready: number[] }
  | { type: "championship-start"; stage?: string; matchId: string; seat: number; characters: string[]; skins: string[] }
  | {type:"input-wait";matchId?:string;seat:number;seconds:number}
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
      matchId?:string;
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
  // Server-generated checksum; seat -1 is the authority, never a player.
  | { type: "hash"; matchId?: string; seat: -1; frame: number; hash: string }
  | { type: "pong"; sent: number }
  | { type: "error"; message: string; code?: "VERSION_MISMATCH"; expected?: string; received?: string }
  | { type: "left"; matchId?:string; seat: number; frame: number };
