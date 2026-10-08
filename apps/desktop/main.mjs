/* global Response, Headers */
import {app,BrowserWindow,Menu,dialog,ipcMain,net,protocol,session} from 'electron';
import {readFileSync,appendFileSync,mkdirSync,statSync,renameSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import process from 'node:process';
import {APP_ORIGIN,assetPath,trustedDocument,safeDevURL,contentPolicy,desktopTitle} from './policy.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const metadata=JSON.parse(readFileSync(path.join(here,'metadata.json'),'utf8'));
app.setName(metadata.productName);app.setAppUserModelId(metadata.appId);
// A stable production origin/profile is required to preserve localStorage across updates.
const devURL=!app.isPackaged?safeDevURL(process.env.ABROZ_DESKTOP_URL):undefined;
if(devURL)app.setPath('userData',path.join(app.getPath('appData'),'Abroz Combat Development'));
protocol.registerSchemesAsPrivileged([{scheme:'abroz',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
let window;
let logged=0;
function log(event){
 if(logged++>200)return;
 try{const dir=path.join(app.getPath('userData'),'logs');mkdirSync(dir,{recursive:true});const file=path.join(dir,'desktop.log');
 try{if(statSync(file).size>256*1024)renameSync(file,file+'.previous');}catch{/* first log */}
 appendFileSync(file,`${new Date().toISOString()} ${event}\n`);
 }catch{/* Logging must never prevent play. */}
}
function failure(message){log('startup-failure');dialog.showErrorBox(metadata.productName,message);}
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
 app.whenReady().then(async()=>{
  const root=app.isPackaged?path.join(process.resourcesPath,'game'):path.resolve(here,'../../dist-desktop');
  const config=devURL?{wsURL:''}:JSON.parse(readFileSync(path.join(root,'desktop-config.json'),'utf8'));
  const csp=contentPolicy(config.wsURL);
  const title=desktopTitle(metadata.productName,app.getVersion(),config.buildVersion);
  protocol.handle('abroz',async request=>{
   if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
   try {
    const file=assetPath(root,request.url);const relative=path.relative(realpathSync(root),realpathSync(file));
    if(relative.startsWith('..')||path.isAbsolute(relative))return new Response('Forbidden',{status:403});
    const result=await net.fetch(pathToFileURL(file).href,{method:request.method,headers:request.headers});
    const headers=new Headers(result.headers);headers.set('Content-Security-Policy',csp);headers.set('X-Content-Type-Options','nosniff');return new Response(result.body,{status:result.status,headers});
   }catch{return new Response('Game asset unavailable',{status:404});}
  });
  const allowedPermissions=new Set(['fullscreen']);
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(!!window&&contents===window.webContents&&details.isMainFrame&&trustedDocument(details.requestingUrl,devURL)&&allowedPermissions.has(permission)));
  session.defaultSession.setPermissionCheckHandler((contents,permission,origin)=>!!window&&contents===window.webContents&&trustedDocument(origin,devURL)&&allowedPermissions.has(permission));
  session.defaultSession.on('will-download',event=>event.preventDefault());
  ipcMain.handle('abroz:fullscreen',event=>{if(event.sender!==window?.webContents||event.senderFrame!==window.webContents.mainFrame||!trustedDocument(event.senderFrame.url,devURL))throw Error('Untrusted fullscreen request');window.setFullScreen(!window.isFullScreen());});
  ipcMain.on('abroz:failure',(event,category)=>{if(event.sender===window?.webContents&&event.senderFrame===window.webContents.mainFrame&&trustedDocument(event.senderFrame.url,devURL)&&['initialization','graphics','assets'].includes(category))log(`renderer-${category}`);});
  Menu.setApplicationMenu(null);
  const create=async()=>{
   window=new BrowserWindow({title,width:1280,height:800,minWidth:800,minHeight:500,backgroundColor:'#080e12',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,devTools:!app.isPackaged}});
   window.on('page-title-updated',event=>{event.preventDefault();window.setTitle(title);});
   window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   window.webContents.on('will-navigate',(event,url)=>{if(!trustedDocument(url,devURL))event.preventDefault();});
   window.webContents.on('will-redirect',(event,url)=>{if(!trustedDocument(url,devURL))event.preventDefault();});
   window.webContents.on('will-attach-webview',event=>event.preventDefault());
   window.webContents.on('render-process-gone',()=>{log('renderer-process-gone');dialog.showErrorBox(metadata.productName,'The game stopped unexpectedly. Please restart it. Your saved settings are kept.');});
   window.webContents.on('unresponsive',()=>log('renderer-unresponsive'));
   window.webContents.on('did-fail-load',(_e,code,_description,_url,isMainFrame)=>{if(isMainFrame&&code!==-3)failure('The game could not load. Restart it or reinstall the application.');});
   window.once('ready-to-show',()=>window.show());
   window.on('closed',()=>{window=undefined;});
   await window.loadURL(devURL||`${APP_ORIGIN}/`);
  };
  log(`start version=${app.getVersion()} build=${String(config.buildVersion??app.getVersion()).replace(/[\r\n]/g,' ').slice(0,100)} platform=${process.platform} arch=${process.arch}`);
  await create();app.on('activate',()=>{if(!window)void create().catch(()=>failure('Unable to open the game window.'));});
 }).catch(()=>{failure('Unable to initialize Abroz Combat. Check that the application files are intact.');app.quit();});
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
