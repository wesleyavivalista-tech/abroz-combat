import { Button } from '../../../../packages/game-core/types.js';
export const MAX_LOCAL_GAMEPADS = 8;
export const DEFAULT_DEADZONE = .2;
// Crouching needs a deliberate downward push, not lateral stick wobble.
export const CROUCH_STICK_THRESHOLD = .6;
export const DEFAULT_ATTACK_BUTTONS = [2, 3, 1, 5, 7, 4, 6];
export const STANDARD = { confirm: 0, back: 1, pause: 9, view: 8, previous: 4, next: 5, up: 12, down: 13, left: 14, right: 15 } as const;
const attackBits = [Button.Light, Button.Medium, Button.Heavy, Button.Special, Button.Special2, Button.Super1, Button.Super2];
export type MenuAction = 'left'|'right'|'up'|'down'|'confirm'|'back'|'pause'|'previous'|'next';
export interface PadSample { index: number; id: string; mapping: string; connected: boolean; axes: readonly number[]; buttons: readonly {pressed: boolean; value: number}[] }
export interface ControllerDevice {
 key: number; index: number; id: string; name: string; brand: 'xbox'|'playstation'|'generic'; mapping: string; connected: boolean;
 player: number|null; buttons: number[]; previousButtons: number[]; axes: number[]; previousAxes: number[]; lastActivity: number;
 mask: number; pressed: number; released: number; pending: number; blocked: boolean; direction: string; repeatAt: number;
}
export interface ControllerEvent { kind: 'join'|'disconnect'|'activity'|'menu'|'assigned'; device: number; player: number|null; action?: MenuAction }
export function controllerName(id: string): {name:string;brand:ControllerDevice['brand']} {
 if (/dualsense|dualshock|playstation|054c|sony/i.test(id)) return {name:/dualsense/i.test(id)?'DualSense Controller':'PlayStation Controller',brand:'playstation'};
 if (/xbox|xinput|045e|microsoft/i.test(id)) return {name:'Xbox Controller',brand:'xbox'};
 return {name: id.replace(/\([^)]*\)/g,'').trim().slice(0,48)||'Generic Controller',brand:'generic'};
}
/** Menus choose one deliberate direction; gameplay still permits diagonals. */
export function menuDirection(buttons:readonly number[],axes:readonly number[],previous=''):MenuAction|'' {
 const held=(i:number)=>(buttons[i]??0)>.5;
 const dx=Number(held(STANDARD.right))-Number(held(STANDARD.left));
 const dy=Number(held(STANDARD.down))-Number(held(STANDARD.up));
 if(dx||dy)return Math.abs(dy)>Math.abs(dx)?(dy<0?'up':'down'):(dx<0?'left':'right');
 const x=axes[0]??0,y=axes[1]??0;
 const magnitude=Math.max(Math.abs(x),Math.abs(y));
 if(magnitude<(previous ? .35 : .55))return '';
 // Retain the selected axis near a diagonal to avoid alternating every poll.
 if((previous==='left'||previous==='right')&&Math.abs(x)>=Math.abs(y)*.8&&Math.sign(x)===(previous==='left'?-1:1))return previous;
 if((previous==='up'||previous==='down')&&Math.abs(y)>=Math.abs(x)*.8&&Math.sign(y)===(previous==='up'?-1:1))return previous;
 return Math.abs(x)>Math.abs(y)?(x<0?'left':'right'):(y<0?'up':'down');
}
/** Session identities deliberately never persist: browser indices and IDs are not physical serial numbers. */
export class GamepadManager {
 readonly devices = new Map<number, ControllerDevice>();
 readonly slots: (number|null)[];
 readonly keyboardClaimed = new Set<number>();
 deadzone = DEFAULT_DEADZONE;
 attackButtons = [...DEFAULT_ATTACK_BUTTONS];
 revision = 0;
 events: ControllerEvent[] = [];
 capture: {player:number}|{identify:number}|null = null;
 testing: number|null = null;
 private serial=0;
 constructor(readonly cap=MAX_LOCAL_GAMEPADS) { this.slots=Array.from({length:cap},()=>null); }
 device(player:number) { const key=this.slots[player];return key==null?undefined:this.devices.get(key); }
 label(player:number) { const d=this.device(player);return d?`${d.name} · ${d.connected?'Connected':'Disconnected'}`:player<2?`Keyboard ${player+1}`:'Press any button to join'; }
 ready(player:number) { const d=this.device(player);return d?d.connected&&d.mapping==='standard':player<2; }
 assign(key:number,player:number) {
  const d=this.devices.get(key);if(!d?.connected||d.mapping!=='standard'||player<0||player>=this.cap)return false;
  const old=this.device(player);if(old){old.player=null;this.suppress(old);}
  if(d.player!==null)this.slots[d.player]=null;
  this.slots[player]=key;d.player=player;this.suppress(d);this.revision++;
  this.events.push({kind:'assigned',device:key,player});return true;
 }
 release(player:number) { const d=this.device(player);if(d){d.player=null;this.suppress(d);}this.slots[player]=null;this.revision++; }
 private suppress(d:ControllerDevice) { this.events=this.events.filter(e=>e.kind!=='menu'||e.device!==d.key);d.mask=0;d.pressed=0;d.released=0;d.pending=0;d.blocked=true;d.direction=''; }
 discover(pad:PadSample):ControllerDevice {
  let d=Array.from(this.devices.values()).find(d=>d.connected&&d.index===pad.index&&d.id===pad.id);
  if(!d){
    d={key:++this.serial,index:pad.index,id:pad.id,...controllerName(pad.id),mapping:pad.mapping,connected:true,player:null,buttons:[],previousButtons:[],axes:[],previousAxes:[],lastActivity:0,mask:0,pressed:0,released:0,pending:0,blocked:false,direction:'',repeatAt:0};
    this.devices.set(d.key,d);this.revision++;
   }
  return d;
 }
 disconnect(index:number) {
  for(const d of this.devices.values())if(d.connected&&d.index===index){d.connected=false;this.suppress(d);d.buttons=[];d.axes=[];this.revision++;this.events.push({kind:"disconnect",device:d.key,player:d.player});}
 }
 clear() { for(const d of this.devices.values())this.suppress(d); }
 consume(player:number) { const d=this.device(player);if(!d?.connected)return 0;const mask=d.mask|d.pending;d.pending=0;return mask; }
 drain() { const events=this.events;this.events=[];return events; }
 update(samples: readonly (PadSample|null)[],now:number,allowJoin=true,joinLimit=this.cap) {
  const seen=new Set<number>();
  for(const pad of samples){
   if(!pad?.connected)continue;
   const d=this.discover(pad);
   seen.add(d.key);d.previousButtons=d.buttons;d.previousAxes=d.axes;
   d.buttons=pad.buttons.map(b=>b.pressed?Math.max(.51,b.value):b.value);d.axes=Array.from(pad.axes);
   const down=(i:number)=>d!.buttons[i]>.5;
   const fresh=d.buttons.some((v,i)=>v>.5&&!(d!.previousButtons[i]>.5));
   const stickFresh=Math.max(Math.abs(d.axes[0]??0),Math.abs(d.axes[1]??0))>=.55&&Math.max(Math.abs(d.previousAxes[0]??0),Math.abs(d.previousAxes[1]??0))<.55;
   if(fresh||stickFresh){d.lastActivity=now;this.events.push({kind:'activity',device:d.key,player:d.player});}
   if(d.mapping!=='standard')continue;
   // Keep a controller-only exit available while normal navigation is suppressed.
   if((this.testing!==null&&down(STANDARD.pause)&&!(d.previousButtons[STANDARD.pause]>.5))||(this.capture&&down(STANDARD.back)&&!(d.previousButtons[STANDARD.back]>.5))){
    this.suppress(d);this.events.push({kind:'menu',device:d.key,player:d.player??0,action:'back'});continue;
   }
   if(fresh&&this.capture){
    if('player' in this.capture){this.assign(d.key,this.capture.player);this.capture=null;continue;}
    if(this.capture.identify===d.key){this.capture=null;this.suppress(d);continue;}
    this.suppress(d);continue;
   }
   if((fresh||stickFresh)&&allowJoin&&d.player===null&&this.testing===null){
    const missing=this.slots.findIndex((key,i)=>i<joinLimit&&key!==null&&!this.devices.get(key)?.connected);
    const slot=missing>=0?missing:this.slots.findIndex((key,i)=>i<joinLimit&&key===null&&!this.keyboardClaimed.has(i));
    if(slot>=0){this.assign(d.key,slot);this.events.push({kind:'join',device:d.key,player:slot});continue;}
   }
   let mask=0;
   if(down(STANDARD.left)||(d.axes[0]??0)<-this.deadzone)mask|=Button.Left;
   if(down(STANDARD.right)||(d.axes[0]??0)>this.deadzone)mask|=Button.Right;
   if(down(STANDARD.confirm)&&!this.attackButtons.includes(STANDARD.confirm))mask|=Button.Up;
   if(down(STANDARD.down)||(d.axes[1]??0)>Math.max(this.deadzone,CROUCH_STICK_THRESHOLD))mask|=Button.Down;
   this.attackButtons.forEach((b,i)=>{if(down(b))mask|=attackBits[i];});
   if(d.blocked){if(!d.buttons.some(v=>v>.5)&&!d.axes.slice(0,2).some(v=>Math.abs(v)>this.deadzone))d.blocked=false;continue;}
   if(this.testing!==null||this.capture){this.suppress(d);continue;}
   d.pressed=mask&~d.mask;d.released=d.mask&~mask;d.mask=mask;d.pending|=d.pressed;
   if(d.player===null)continue;
   const direction=menuDirection(d.buttons,d.axes,d.direction);
   if(direction&&(direction!==d.direction||now>=d.repeatAt)){
    this.events.push({kind:'menu',device:d.key,player:d.player,action:direction});d.repeatAt=now+(direction===d.direction?110:350);
   }
   d.direction=direction;
   for(const action of ['confirm','back','pause','previous','next'] as const){const b=STANDARD[action];if(down(b)&&!(d.previousButtons[b]>.5))this.events.push({kind:'menu',device:d.key,player:d.player,action});}
  }
  for(const d of this.devices.values())if(d.connected&&!seen.has(d.key)){
   d.connected=false;this.suppress(d);d.buttons=[];d.axes=[];this.revision++;this.events.push({kind:'disconnect',device:d.key,player:d.player});
  }
  // Retain recent diagnostics, but not every historical Bluetooth identity.
  // Reserved seats, open diagnostics and queued notifications still own their records.
  if(this.devices.size>this.cap){
   const pending=new Set(this.events.map(e=>e.device));
   const obsolete=Array.from(this.devices.values()).filter(d=>!d.connected&&d.player===null&&
    d.key!==this.testing&&!(this.capture&&'identify' in this.capture&&this.capture.identify===d.key)&&!pending.has(d.key));
   for(const d of obsolete.slice(0,Math.max(0,obsolete.length-this.cap))){this.devices.delete(d.key);this.revision++;}
  }
 }
}

export function controllerButtonName(index:number,brand:ControllerDevice['brand']) {
 if(brand==='generic')return `Button ${index}`;
 const names=brand==='playstation'?['Cross','Circle','Square','Triangle','L1','R1','L2','R2','Share / Create','Options','L3','R3','D-pad Up','D-pad Down','D-pad Left','D-pad Right','PS']:['A','B','X','Y','LB','RB','LT','RT','View / Back','Menu / Start','Left stick','Right stick','D-pad Up','D-pad Down','D-pad Left','D-pad Right','Home'];
 return names[index]??`Button ${index}`;
}
