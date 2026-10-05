"""Original, noise-based combat foley; no reference recordings or third-party samples.
Render once with NumPy; runtime only loads small reusable PCM files.
"""
from pathlib import Path
import json,wave
import numpy as np
out=Path(__file__).resolve().parents[1]/'apps/client/public/audio/combat-v2';out.mkdir(parents=True,exist_ok=True)
sr=24000
families=['fist','foot','body','blade','axe','shaft','guitar','whip','flame']
manifest=[]
for fi,family in enumerate(families):
 for wi,weight in enumerate(['light','heavy','charged']):
  for phase in ['swing','hit']:
   for variant in range(3):
    rng=np.random.default_rng(59000+fi*100+wi*10+variant)
    duration=(.13+.055*wi if phase=='swing' else .18+.09*wi)+( .025 if family in ('axe','guitar','body') else 0)
    n=int(sr*duration);t=np.arange(n)/sr;u=t/duration;noise=rng.normal(0,1,n)
    def smooth(signal,window):return np.convolve(signal,np.ones(window)/window,mode='same')
    low=smooth(noise,80);mid=smooth(noise,7)-smooth(noise,55);high=noise-smooth(noise,6)
    if phase=='swing':
     # Asymmetric air-pressure envelope; weight changes breadth, not just pitch.
     env=np.sin(np.pi*u)**(1.7+wi*.3)*np.exp(-u*.9)
     brightness={'blade':.28,'axe':.12,'shaft':.20,'guitar':.08,'fist':.13,'foot':.16,'body':.06,'whip':.24,'flame':.22}[family]
     signal=(mid*1.4+low*(2+wi)+high*brightness)*env
     # Fabric / shaft flutter with irregular micro-transients.
     for k in range(4+wi):
      center=rng.uniform(.2,.8)*duration;signal+=mid*np.exp(-((t-center)/.003)**2)*.16
    else:
     freq={'fist':92,'foot':68,'body':48,'blade':135,'axe':72,'shaft':110,'guitar':85,'whip':130,'flame':55}[family]*(1-wi*.10)
     attack=np.minimum(t/.0015,1)
     body=np.sin(2*np.pi*(freq*t+1.1*(1-np.exp(-t*55))))*np.exp(-t*(30-wi*5))
     signal=(body*.27+low*2.8*np.exp(-t*22)+mid*1.7*np.exp(-t*50)+high*.14*np.exp(-t*160))*attack
     if family in ('blade','axe'):
      # Brief inharmonic steel detail, kept beneath the contact transient.
      signal+=sum(.035*np.sin(2*np.pi*f*t)*np.exp(-t*70) for f in [1733+variant*19,2917,4103]) *attack
     if family in ('shaft','guitar'):
      signal+=.1*np.sin(2*np.pi*317*t)*np.exp(-t*55)*attack
     if family=='flame':signal+=mid*np.exp(-t*17)*.7*attack
     if family=='whip':signal+=high*.20*np.exp(-t*190)*attack
    signal*=np.minimum(t/.0015,1)*np.minimum((duration-t)/.018,1)
    signal=np.tanh(signal*1.4);signal*=.76/max(np.max(np.abs(signal)),1e-9)
    name=f'{family}-{weight}-{phase}-{variant+1}.wav'
    with wave.open(str(out/name),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes((signal*32767).astype('<i2').tobytes())
    manifest.append({'file':name,'seconds':round(duration,3)})
# Quiet non-tonal held tension; loops stop when the charge is released/cancelled.
rng=np.random.default_rng(411);n=sr;t=np.arange(n)/sr;noise=rng.normal(0,1,n);signal=np.convolve(noise,np.ones(18)/18,mode='same')*(.65+.25*np.sin(2*np.pi*3*t));signal*=.5/max(np.max(np.abs(signal)),1e-9);signal[:200]*=np.linspace(0,1,200);signal[-200:]*=np.linspace(1,0,200)
with wave.open(str(out/'charge.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes((signal*32767).astype('<i2').tobytes())
(out/'manifest.json').write_text(json.dumps({'source':'Original offline procedural foley, no external recordings. Not an ear-matched Brawlhalla recreation.','generator':'scripts/create-combat-foley.py','assets':manifest},indent=2)+'\n')
print(len(manifest)+1,'original short PCM assets')
