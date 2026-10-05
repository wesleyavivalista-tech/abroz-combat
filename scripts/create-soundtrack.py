"""Original Abroz instrumental score. NumPy + stdlib; no sampled or external music.
16-bar arrangements with wrapped delays and synthesis tails for seamless PCM loops.
Run with Python + numpy. WAV masters also serve as browser playback assets.
"""
from pathlib import Path
import json, wave
import numpy as np
OUT=Path(__file__).resolve().parents[1]/'apps/client/public/audio/music'
OUT.mkdir(parents=True,exist_ok=True)
SR=22050
SONGS={
 'menu_01':(108,45,'lounge'), 'selection_01':(120,45,'select'),
 'rooftop_01':(128,40,'break'), 'rooftop_02':(124,43,'break'),
 'court_01':(98,38,'hiphop'), 'mall_01':(116,45,'house'),
 'church_01':(106,48,'keys'), 'party_01':(118,43,'funk'),
 'championship_01':(132,40,'event'), 'championship_final_01':(144,40,'final'),
 'sudden_01':(156,40,'final'), 'victory_01':(120,48,'win'), 'defeat_01':(90,45,'lose')}
manifest=[]
for serial,(name,(bpm,root,style)) in enumerate(SONGS.items()):
 rng=np.random.default_rng(830+serial);beat=60/bpm;sting=style in ('win','lose');bars=4 if sting else 16
 n=round(bars*4*beat*SR);mix=np.zeros((n,2));loop=not sting
 def add(signal,start,amp=1,pan=0):
  index=round(start*SR)+np.arange(len(signal));stereo=signal[:,None]*np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])[None,:]*amp
  if loop:np.add.at(mix,index%n,stereo)
  else:
   valid=index<n;mix[index[valid]]+=stereo[valid]
 def note(midi,start,length,amp,kind='pluck',pan=0):
  t=np.arange(round((length+.18)*SR))/SR;freq=440*2**((midi-69)/12)
  if kind=='bass':
   tone=np.sin(2*np.pi*freq*t)+.22*np.sin(4*np.pi*freq*t)+.08*np.sin(6*np.pi*freq*t);env=np.minimum(t/.008,1)*np.exp(-t*2)
  elif kind=='pad':
   tone=(np.sin(2*np.pi*freq*t)+.25*np.sin(2*np.pi*(freq*1.003)*t)+.16*np.sin(4*np.pi*freq*t));env=np.minimum(t/.12,1)*.7
  else:
   tone=np.sin(2*np.pi*freq*t)+.32*np.sin(4*np.pi*freq*t)*np.exp(-t*6)+.16*np.sin(2*np.pi*freq*3*t)*np.exp(-t*12);env=np.minimum(t/.004,1)*np.exp(-t*(4 if kind=='keys' else 6))
  env*=np.clip((length+.18-t)/.18,0,1);sig=tone*env;add(sig,start,amp,pan)
  if kind!='bass':
   for echo,gain in [(beat*.75,.16),(beat*1.5,.07)]:add(sig,start+echo,amp*gain,-pan)
 def drum(kind,start,amp=1):
  duration={'kick':.30,'snare':.19,'hat':.07,'open':.20}[kind];t=np.arange(round(SR*duration))/SR;noise=rng.normal(0,1,len(t))
  if kind=='kick':sig=np.sin(2*np.pi*(46*t+3*(1-np.exp(-t*28))))*np.exp(-t*16)+noise*.05*np.exp(-t*140);gain=.55
  elif kind=='snare':sig=(noise*.55+np.sin(2*np.pi*175*t)*.45)*np.exp(-t*24)*np.minimum(t/.001,1);gain=.25
  else:sig=(noise-np.roll(noise,1))*.35*np.exp(-t*(65 if kind=='hat' else 24));gain=.13
  add(sig,start,amp*gain, .24 if kind in ('hat','open') else 0)
 progression=[0,-5,3,-2] if style not in ('funk','win') else [0,5,7,5]
 melody=[7,10,12,7,5,3,5,0, 7,10,14,12,10,7,5,3]
 for bar in range(bars):
  base=root+progression[(bar//2)%4];start=bar*4*beat;section=bar//4
  energy=.65 if style in ('lounge','keys','lose') else 1
  if section==2:energy*=.7
  chord=[base+12,base+15,base+19,base+22]
  for j,m in enumerate(chord):note(m,start,3.7*beat,.075,'pad',(j-1.5)*.30)
  for step in [0,1.5,2.5,3.25] if style in ('hiphop','break','funk') else [0,.75,2,2.75,3.5]:
   note(base+(12 if step==3.5 else 0),start+step*beat,.42*beat,.27*energy,'bass')
  if style not in ('lose','win'):
   kicks=[0,1,2,3] if style=='house' else [0,1.75,2.5]
   if style=='final':kicks=[0,.75,1.5,2,2.75,3.5]
   for b in kicks:drum('kick',start+b*beat,energy)
   for b in [1,3]:drum('snare',start+b*beat,energy)
   for step in range(8):drum('open' if step==7 else 'hat',start+(step*.5+(.055 if step%2 else 0))*beat,energy*(.60 if step%2==0 else .85))
   if bar%4==3:
    for step in [3.25,3.5,3.75]:drum('snare',start+step*beat,.25*energy)
  elif style=='win' and bar<3:drum('kick',start,.6)
  # A shared melodic signature, with different voicings and rhythmic arrangements.
  for step in range(4):
   if section==2 and step%2:continue
   degree=melody[(bar%4)*4+step]
   note(root+24+degree,start+(step+.25*(step%2))*beat,.5*beat,.105*energy,'keys' if style in ('keys','lounge','hiphop') else 'pluck',(-.35 if step%2 else .35))
  if style in ('house','funk','select','event','final'):
   for step in [ .5,1.5,2.5,3.5]:
    for j,m in enumerate(chord[:3]):note(m,start+step*beat,.16*beat,.055,'keys',(j-1)*.4)
 if not loop:
  fade=min(n,round(SR*1.5));mix[-fade:]*=np.linspace(1,0,fade)[:,None];mix[:100]*=np.linspace(0,1,100)[:,None]
 peak=np.max(np.abs(mix));mix*=.82/max(peak,1e-9)
 pcm=np.round(mix*32767).astype('<i2')
 with wave.open(str(OUT/f'{name}.wav'),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
 manifest.append(dict(id=name,bpm=bpm,style=style,loop=loop,seconds=round(n/SR,3),peak=round(float(np.max(np.abs(mix))),4),rms=round(float(np.sqrt(np.mean(mix**2))),4)))
 print(name,round(n/SR,1),'seconds')
(OUT/'manifest.json').write_text(json.dumps({'authoring':'Original deterministic synthesis and composition; no third-party samples.','generator':'scripts/create-soundtrack.py','tracks':manifest},indent=2)+'\n')
