export const CONTROL_SCHEMA_VERSION=1;
export interface ControlSettings {schemaVersion:number;bindings:string[][];gamepadButtons:number[];deadzone:number}
const namedCodes=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Enter','NumpadEnter','Tab','Backspace','Delete','Insert','Home','End','PageUp','PageDown','Escape','CapsLock','NumLock','ScrollLock','Pause','PrintScreen','ContextMenu','Backquote','Minus','Equal','BracketLeft','BracketRight','Backslash','Semicolon','Quote','Comma','Period','Slash','IntlBackslash','IntlRo','IntlYen','Convert','NonConvert','KanaMode','Lang1','Lang2','Lang3','Lang4','Lang5','NumpadAdd','NumpadSubtract','NumpadMultiply','NumpadDivide','NumpadDecimal','NumpadComma','NumpadEqual','NumpadParenLeft','NumpadParenRight','NumpadBackspace','NumpadClear','NumpadClearEntry','NumpadHash','NumpadStar','NumpadMemoryAdd','NumpadMemoryClear','NumpadMemoryRecall','NumpadMemoryStore','NumpadMemorySubtract','AudioVolumeDown','AudioVolumeUp','AudioVolumeMute','MediaPlayPause','MediaStop','MediaTrackNext','MediaTrackPrevious','MediaSelect','LaunchMail','LaunchApp1','LaunchApp2','BrowserBack','BrowserForward','BrowserRefresh','BrowserStop','BrowserSearch','BrowserFavorites','BrowserHome','Help','Again','Copy','Cut','Find','Open','Paste','Props','Select','Undo','Eject','Power','Sleep','WakeUp','Abort','Resume','Suspend','Turbo','Hyper','Super','Fn','FnLock']);
export function validKeyboardCode(value:unknown):value is string{
 return typeof value==='string'&&(namedCodes.has(value)||/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|F([1-9]|1[0-9]|2[0-4])|(Shift|Control|Alt|Meta)(Left|Right))$/.test(value));
}
/** Never writes on load. Unknown future schemas remain intact for a later upgrade. */
export function readControlSettings(raw:string|null,defaults:Omit<ControlSettings,'schemaVersion'>):{settings:ControlSettings;writable:boolean}{
 const settings:ControlSettings={schemaVersion:CONTROL_SCHEMA_VERSION,bindings:defaults.bindings.map(row=>[...row]),gamepadButtons:[...defaults.gamepadButtons],deadzone:defaults.deadzone};
 let saved;try{saved=JSON.parse(raw??'null');}catch{return {settings,writable:true};}
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return {settings,writable:true};
 if(saved.schemaVersion!==undefined&&saved.schemaVersion!==CONTROL_SCHEMA_VERSION)return {settings,writable:false};
 if(Array.isArray(saved.bindings))settings.bindings=settings.bindings.map((row,p)=>row.map((key,i)=>Array.isArray(saved.bindings[p])&&validKeyboardCode(saved.bindings[p][i])?saved.bindings[p][i]:key));
 if(typeof saved.deadzone==='number'&&Number.isFinite(saved.deadzone)&&saved.deadzone>=.1&&saved.deadzone<=.4)settings.deadzone=saved.deadzone;
 // Preserve the existing unversioned-default migration; versioned custom mappings are never inferred.
 const legacyDefault=saved.schemaVersion===undefined&&JSON.stringify(saved.gamepadButtons)===JSON.stringify([0,2,1,3,5,6,7]);
 if(Array.isArray(saved.gamepadButtons)&&!legacyDefault)settings.gamepadButtons=settings.gamepadButtons.map((button,i)=>Number.isInteger(saved.gamepadButtons[i])&&saved.gamepadButtons[i]>=0&&saved.gamepadButtons[i]<16?saved.gamepadButtons[i]:button);
 return {settings,writable:true};
}
