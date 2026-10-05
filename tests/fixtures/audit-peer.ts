// Manual localhost audit peer: join only the explicitly supplied disposable room.
import {WebSocket} from 'ws';
import {contentVersion} from '../../packages/shared/contentVersion.js';
const code=process.argv[2];if(!code)throw new Error('Provide the disposable test room code');
const socket=new WebSocket('ws://localhost:8081');
const timeout=setTimeout(()=>socket.close(),30000);
socket.on('open',()=>socket.send(JSON.stringify({type:'join',code,character:'gut',contentVersion:contentVersion()})));
socket.on('message',raw=>{
 const m=JSON.parse(raw.toString());
 if(m.type==='room')socket.send(JSON.stringify({type:'ready'}));
 if(m.type==='start')socket.send(JSON.stringify({type:'hash',frame:0,hash:'0'}));
 if(m.type==='left'){console.log('Test client disconnected after injected hash disagreement');socket.close();}
 if(m.type==='error'){console.error(m.message);socket.close();}
});
socket.on('close',()=>clearTimeout(timeout));
