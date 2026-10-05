/* eslint-disable @typescript-eslint/no-require-imports -- Electron sandbox preload and builder config use CommonJS. */
/* global require */
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('abrozDesktop',Object.freeze({
 toggleFullscreen:()=>ipcRenderer.invoke('abroz:fullscreen'),
 reportFailure:category=>{if(['initialization','graphics','assets'].includes(category))ipcRenderer.send('abroz:failure',category);},
}));
