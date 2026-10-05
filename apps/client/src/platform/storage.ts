/** Same keys and JSON schemas on web and desktop. Desktop Chromium persists its own app profile. */
export const storage = {
 getItem(key:string):string|null {try{return globalThis.localStorage.getItem(key);}catch{return null;}},
 setItem(key:string,value:string):void {try{globalThis.localStorage.setItem(key,value);}catch{/* Defaults/current-session settings remain usable when storage is unavailable. */}},
};
