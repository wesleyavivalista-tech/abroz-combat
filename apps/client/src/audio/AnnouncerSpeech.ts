/** Optional local device speech: no network requests, recordings, or queued countdowns. */
export class AnnouncerSpeech {
  private active?:SpeechSynthesisUtterance;
  speak(text:string,volume:number):void {
    this.cancel();
    if(volume<=0||typeof speechSynthesis==='undefined'||typeof SpeechSynthesisUtterance==='undefined')return;
    try {
      const voices=speechSynthesis.getVoices().filter(v=>v.localService&&v.lang.startsWith('en'));
      const voice=voices.find(v=>/Daniel|Alex|David|George|Guy/i.test(v.name))??voices.find(v=>v.default)??voices[0];
      if(!voice)return; // Keep the visual countdown and existing audio cue on unsupported devices.
      const utterance=new SpeechSynthesisUtterance(text);
      utterance.voice=voice;utterance.lang=voice.lang;
      const fight=text==='Fight!',dead=text==='DEAD.';
      utterance.rate=dead?.6:fight?.88:.78;utterance.pitch=dead?.45:fight?.65:.72;utterance.volume=Math.min(1,volume);
      this.active=utterance;
      const done=()=>{if(this.active===utterance)this.active=undefined;};
      utterance.onend=done;utterance.onerror=done;
      speechSynthesis.speak(utterance);
    }catch{this.cancel();}
  }
  cancel():void {
    if(!this.active)return;
    this.active.onend=null;this.active.onerror=null;this.active=undefined;
    try{speechSynthesis.cancel();}catch{/* Speech is optional. */}
  }
}
