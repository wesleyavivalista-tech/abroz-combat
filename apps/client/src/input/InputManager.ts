import {storage} from '../platform/storage.js';
import { Button } from "../../../../packages/game-core/types.js";
import { GamepadManager } from "./GamepadManager.js";
export const actions = [
  "Left",
  "Right",
  "Up",
  "Down",
  "Combo attack",
  "Heavy attack",
  "Attack 3",
  "Special 1",
  "Special 2",
  "Ultimate 1",
  "Ultimate 2",
] as const;
const bits = [
  Button.Left,
  Button.Right,
  Button.Up,
  Button.Down,
  Button.Light,
  Button.Medium,
  Button.Heavy,
  Button.Special,
  Button.Special2,
  Button.Super1,
  Button.Super2,
];
export class InputManager {
  keys = new Set<string>();
  pending = new Set<string>();
  bindings = [
    [
      "KeyA",
      "KeyD",
      "KeyW",
      "KeyS",
      "KeyJ",
      "KeyK",
      "KeyL",
      "KeyI",
      "KeyU",
      "KeyO",
      "KeyP",
    ],
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit0",
      "Digit9",
      "Digit7",
      "Digit8",
    ],
  ];
  readonly controllers = new GamepadManager();
  get gamepadButtons() { return this.controllers.attackButtons; }
  set gamepadButtons(value:number[]) { this.controllers.attackButtons=value; }
  systemActions: ("pause"|"debug"|"reset")[] = [];
  private focused = true;
  refresh(allowJoin=true,limit=this.controllers.cap):void {
    if(!this.focused)return;
    try { this.controllers.update(navigator.getGamepads?.() ?? [], performance.now(),allowJoin,limit); } catch { this.controllers.update([],performance.now(),false); /* Keyboard remains available if the browser blocks gamepads. */ }
  }
  enabled = true;
  private lifetime=new AbortController();
  constructor() {
    try {
      const saved = JSON.parse(
        storage.getItem("afterglow-controls") ?? "null",
      );
      if (saved?.bindings?.length === 2)
        this.bindings = this.bindings.map((row, p) =>
          row.map((key, i) =>
            typeof saved.bindings[p]?.[i] === "string"
              ? saved.bindings[p][i]
              : key,
          ),
        );
      if (typeof saved?.deadzone === "number" && saved.deadzone >= .1 && saved.deadzone <= .4) this.controllers.deadzone=saved.deadzone;
      if (Array.isArray(saved?.gamepadButtons) && JSON.stringify(saved.gamepadButtons)!==JSON.stringify([0,2,1,3,5,6,7]))
        this.gamepadButtons = this.gamepadButtons.map((button, i) =>
          Number.isInteger(saved.gamepadButtons[i]) && saved.gamepadButtons[i] >= 0 && saved.gamepadButtons[i] < 16
            ? saved.gamepadButtons[i]
            : button,
        );
    } catch {
      /* Defaults remain available. */
    }
    window.addEventListener("keydown", (e) => {
      if(!this.focused)return;
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (e.code === "Escape" || e.code === "F1") { e.preventDefault(); if (!e.repeat) this.systemActions.push(e.code === "Escape" ? "pause" : "debug"); }
      if (e.code === "KeyR" && !e.repeat) this.systemActions.push("reset");
      // A key held across a screen reset must be released before gameplay resumes.
      if(e.repeat&&!this.keys.has(e.code))return;
      this.bindings.forEach((row,i)=>{if(row.includes(e.code))this.controllers.keyboardClaimed.add(i);});
      if (this.enabled && this.bindings.flat().includes(e.code))
        e.preventDefault();
      this.keys.add(e.code);
      if (this.enabled) this.pending.add(e.code);
    },{signal:this.lifetime.signal});
    window.addEventListener("gamepadconnected", (e) => this.controllers.discover(e.gamepad),{signal:this.lifetime.signal});
    window.addEventListener("gamepaddisconnected", (e) => {if(this.focused)this.controllers.disconnect(e.gamepad.index);},{signal:this.lifetime.signal});
    window.addEventListener("keyup", (e) => this.keys.delete(e.code),{signal:this.lifetime.signal});
    window.addEventListener("blur", () => {this.focused=false;this.clear();},{signal:this.lifetime.signal});
    window.addEventListener("focus", () => {this.clear();this.focused=true;},{signal:this.lifetime.signal});
  }
  dispose():void{this.lifetime.abort();this.enabled=false;this.clear();}
  poll(player: number): number {
    if (!this.enabled || !this.focused) return 0;
    let mask = 0;
    this.bindings[player]?.forEach((key, i) => {
      if (this.keys.has(key) || this.pending.has(key)) mask |= bits[i];
      this.pending.delete(key);
    });
    mask |= this.controllers.consume(player);
    return mask;
  }
  clear(): void {
    this.systemActions.length=0;
    this.keys.clear();
    this.pending.clear();
    this.controllers.clear();
  }
  save(): void {
    try { storage.setItem(
      "afterglow-controls",
      JSON.stringify({
        bindings: this.bindings,
        gamepadButtons: this.gamepadButtons,
        deadzone: this.controllers.deadzone,
      }),
    ); } catch { /* Controls still work when browser storage is unavailable. */ }
  }
}
