"""Original procedural effects. No external samples. Reproducible PCM WAV generation."""
import math, random, struct, wave
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'apps/client/public/audio/nikalz'
out.mkdir(parents=True,exist_ok=True)
rate=24000

def save(name,values):
    peak=max(abs(v) for v in values) or 1
    with wave.open(str(out/name),'wb') as f:
        f.setparams((1,2,rate,0,'NONE','not compressed'))
        f.writeframes(b''.join(struct.pack('<h',round(v/peak*.85*32767)) for v in values))

def impact(name,duration,seed,weight):
    rng=random.Random(seed);low=0;phase=0;values=[]
    for i in range(int(rate*duration)):
        t=i/rate;n=rng.uniform(-1,1);low+=.14*(n-low)
        phase+=2*math.pi*(38+weight*42*math.exp(-t*26))/rate
        body=math.sin(phase)*math.exp(-t*(7/weight))
        crack=(n-low)*math.exp(-t*70)*.65
        rubble=low*math.exp(-t*6)*(.2+.8*math.sin(t*83)**8)*1.8
        env=min(1,t/.0015)*min(1,(duration-t)/.03)
        values.append((body*.65+crack+rubble)*env)
    save(name,values)

def buzz(name,duration,envelope=False,sting=False):
    values=[]
    for i in range(int(rate*duration)):
        t=i/rate
        # Multiple beating wing fundamentals + upper harmonics, periodic modulation.
        v=0
        for k,f in enumerate([173,191,207,229,251]):
            ph=2*math.pi*f*t+.9*math.sin(2*math.pi*(3+k)*t)
            v+=(math.sin(ph)+.28*math.sin(2*ph)+.12*math.sin(3*ph))*(.7+.3*math.sin(2*math.pi*(7+k)*t+k))/5
        if envelope:v*=min(1,t/.035)*max(0,1-t/duration)**.55
        if sting:v+=.25*math.sin(2*math.pi*950*t)*math.exp(-t*36)
        values.append(v)
    save(name,values)
for i in range(3):
    impact(f'forehead-{i+1}.wav',.65,10+i,1)
    impact(f'meteor-{i+1}.wav',1.25,30+i,1.7)
buzz('swarm-loop.wav',2)
buzz('swarm-release.wav',.45,True)
buzz('swarm-sting.wav',.2,True,True)
buzz('swarm-end.wav',.22,True)
