import type {GamepadManager,ControllerEvent} from './GamepadManager.js';
/** A local setup gate over the existing session assignments, never a second input owner. */
export class LocalPlayers {
 readonly keyboards=new Set<number>();
 private readyOwners=new Map<number,string>();
 limit=8;minimum=2;required:number|undefined;
 constructor(readonly pads:GamepadManager){}
 configure(limit:number,minimum=2,required?:number){this.limit=Math.min(this.pads.cap,limit);this.minimum=minimum;this.required=required;this.readyOwners.clear();}
 owner(slot:number):string|undefined{const d=this.pads.device(slot);return d?`pad:${d.key}`:this.keyboards.has(slot)?`keyboard:${slot}`:undefined;}
 connected(slot:number){const d=this.pads.device(slot);return d?d.connected&&this.pads.supported(d):this.keyboards.has(slot);}
 get count(){return Array.from({length:this.limit},(_,i)=>this.owner(i)).filter(Boolean).length;}
 get canContinue(){const n=this.count;return n>=this.minimum&&(this.required===undefined||n===this.required)&&Array.from({length:n},(_,i)=>this.connected(i)&&this.isReady(i)).every(Boolean);}
 isReady(slot:number){return this.connected(slot)&&this.readyOwners.has(slot)&&this.readyOwners.get(slot)===this.owner(slot);}
 sync(){for(const slot of this.keyboards)if(this.pads.device(slot))this.keyboards.delete(slot);for(const [slot,owner] of this.readyOwners)if(!this.connected(slot)||this.owner(slot)!==owner)this.readyOwners.delete(slot);}
 toggleReady(slot:number){if(slot<0||slot>=this.limit||!this.connected(slot))return;const owner=this.owner(slot)!;if(this.isReady(slot))this.readyOwners.delete(slot);else this.readyOwners.set(slot,owner);this.pads.clear();}
 join(key:number){const d=this.pads.devices.get(key);if(!d?.connected||!this.pads.supported(d))return false;if(d.player!==null&&d.player<this.limit)return true;
 const missing=Array.from({length:this.limit},(_,i)=>i).find(i=>this.pads.device(i)&&!this.pads.device(i)!.connected);
 const slot=missing??Array.from({length:this.limit},(_,i)=>i).find(i=>!this.owner(i));
 if(slot===undefined)return false;return this.move(key,slot);}
 move(key:number,slot:number){const d=this.pads.devices.get(key);if(!d||!Number.isInteger(slot)||slot<0||slot>=this.limit||this.keyboards.has(slot))return false;
 const occupant=this.pads.device(slot);if(occupant?.connected&&occupant.key!==key)return false;
 if(!this.pads.assign(key,slot))return false;this.readyOwners.clear();return true;}
 shift(key:number,direction:number){const d=this.pads.devices.get(key);if(d?.player==null||d.player>=this.limit)return;for(let n=1;n<this.limit;n++){const slot=(d.player+direction*n+this.limit*2)%this.limit;if(!this.owner(slot)){this.move(key,slot);return;}}}
 leave(key:number){const d=this.pads.devices.get(key);if(d?.player==null)return;this.pads.release(d.player);this.readyOwners.clear();this.pads.clear();}
 keyboard(slot:number){if(slot<0||slot>1||slot>=this.limit)return false;if(this.keyboards.has(slot)){this.keyboards.delete(slot);this.pads.keyboardClaimed.delete(slot);}else{if(this.pads.device(slot))return false;this.keyboards.add(slot);this.pads.keyboardClaimed.add(slot);}this.readyOwners.clear();this.pads.clear();return true;}
 handle(event:ControllerEvent):'continue'|undefined{
 if(event.kind!=='menu'||!event.action)return;
 const d=this.pads.devices.get(event.device);if(!d?.connected)return;
 if(d.player===null||d.player>=this.limit){if(event.action==='confirm')this.join(d.key);return;}
 if(event.action==='confirm')this.toggleReady(d.player);
 else if(event.action==='back'){if(this.isReady(d.player))this.toggleReady(d.player);else this.leave(d.key);}
 else if(event.action==='left'||event.action==='right')this.shift(d.key,event.action==='left'?-1:1);
 else if(event.action==='pause'&&d.player===0&&this.canContinue)return 'continue';
 }
}
