"""Original stylized foley and motifs; deterministic PCM synthesis, no external samples.
Run with the exported material list or regenerate existing family directories.
"""
import math, random, struct, wave
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'apps/client/public/audio/materials'
# Each recipe is deliberately material-based, not a single pitch-shifted beep.
categories={
 'body':'punch kick head body slam mutant monster flex gym hug panda',
 'wood':'wood chess tree knight stamp cookie chomp guitar product masonry',
 'metal':'coins appliance sword spear axe gear turret',
 'air':'feather paper cloud sniff sneeze stealth shadow dart hair plush',
 'liquid':'wine blood water',
 'music':'angel divine romance personality idea ancestry anger perfection chord band star buda meditation immortal metalMusic',
 'insect':'bees spider', 'fire':'fire', 'ball':'football basketball juggle', 'talk':'talk'}
recipe={f:c for c,group in categories.items() for f in group.split()}
families=list(recipe)
rate=16000
for family in families:
 folder=out/family;folder.mkdir(parents=True,exist_ok=True)
 seed=sum((i+1)*ord(c) for i,c in enumerate(family));kind=recipe[family]
 for phase in ['start','active','impact','end']:
  for variant in range(3 if phase=='impact' else 1):
   loop=phase=='active';duration=1 if loop else (.38 if phase=='start' else .45 if phase=='impact' else .24)
   rng=random.Random(seed+variant*71);values=[];low=0;prev=0
   base=55+seed%90;notes=[1,1.25,1.5]
   for i in range(int(rate*duration)):
    t=i/rate;u=t/duration;n=rng.uniform(-1,1);low+=.11*(n-low);high=n-low
    attack=min(1,t/.008);decay=1 if loop else (1-u)**2
    envelope=1 if loop else attack*decay
    # Seamless ends for sustained noise; the tonal components use integer Hz.
    if loop:envelope=.72+.28*math.sin(math.pi*u)**2
    fundamental=int(base)
    if kind=='body':
     freq=45+base/2;v=.7*math.sin(2*math.pi*(freq*t+1.5*(1-math.exp(-t*24))))*math.exp(-t*9 if not loop else 0)+low*1.4+high*.3*math.exp(-t*60)
    elif kind=='wood':
     v=sum(math.sin(2*math.pi*f*t)*math.exp(-t*d if not loop else 0)*a for f,d,a in [(base*3,23,.5),(base*5.3,35,.25),(base*8.1,45,.12)])+high*.3
     if family in ['cookie','chomp','masonry']:v=low*1.9+high*(.12+.55*math.sin(t*120)**14)
    elif kind=='metal':
     v=sum(math.sin(2*math.pi*round(base*f)*t)*a*math.exp(-t*d if not loop else 0) for f,a,d in [(4,.4,8),(7.31,.23,12),(10.8,.15,18)])+high*.18
     if family=='turret':v+=low*2+math.sin(2*math.pi*65*t)*math.exp(-t*18)
    elif kind=='air':
     v=(high*.6+low*.5)*(.3+.7*math.sin(math.pi*u)**2)
     if family in ['paper','hair','plush']:v*=.25+.75*math.sin(t*(140+seed%60))**6
     if family in ['sniff','sneeze']:v=low*2+high*.25
    elif kind=='liquid':
     v=low*2+high*(.4 if family=='water' else .07)
     v+=sum(.1*math.sin(2*math.pi*round(base*(k+3))*t+3*math.sin(2*math.pi*(k+5)*t)) for k in range(3))
    elif kind=='music':
     v=sum(math.sin(2*math.pi*round(base*2*note)*t)*.23 for note in notes)+low*.12
     if family in ['chord','band','star','metalMusic']:v=math.tanh(v*4)*(.4+.6*math.exp(-t*7))
     if family in ['divine','anger','buda']:v+=math.sin(2*math.pi*base*t)*.25+low*.45
    elif kind=='insect':
     v=sum(math.sin(2*math.pi*(base+100+k*17)*t+.6*math.sin(2*math.pi*(5+k)*t))*.15 for k in range(4))
     if family=='spider':v=high*(.15+.8*max(0,math.sin(t*180))**18)
    elif kind=='fire':v=low*2+high*(.1+.9*max(0,math.sin(t*250))**22)
    elif kind=='ball':v=.7*math.sin(2*math.pi*(105*t+1.8*(1-math.exp(-t*32))))*math.exp(-t*15)+low*.9+high*.08
    else:v=(math.sin(2*math.pi*base*t)+.3*math.sin(2*math.pi*base*3*t))*max(0,math.sin(2*math.pi*9*t))**2*.6+low*.1
    if phase=='start' and kind not in ['music','talk','insect']:v=v*.45+high*math.sin(math.pi*u)**2*.45
    if loop and kind not in ['insect','music','talk']:v*=.25
    values.append(v*envelope)
   if loop:
    # Short overlap-add crossfade hides broadband and noninteger resonance seams.
    fade=320
    for j in range(fade):
     a=j/fade;values[-fade+j]=values[-fade+j]*(1-a)+values[j]*a
    values=values[fade:]
   peak=max(abs(v) for v in values) or 1
   name=f'{phase}{"-"+str(variant+1) if phase=="impact" else ""}.wav'
   with wave.open(str(folder/name),'wb') as f:
    f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(b''.join(struct.pack('<h',round(v/peak*.78*32767)) for v in values))
print(f'Generated {len(families)} material families')
