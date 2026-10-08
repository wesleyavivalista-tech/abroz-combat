export type MusicState = 'menu'|'selection'|'intro'|'match'|'final'|'sudden-death'|'victory'|'defeat'|'championship'|'party'|'championship-final';
export interface MusicTrack {
  id: string; url?: string; profile: string; gain: number; loop: boolean;
  intensity?: number; bpm?: number; finalVersion?: string; suddenDeathVersion?: string;
  introVersion?: string; // Only explicitly composed intro sections; no arbitrary MP3 timing.
}
export interface MusicProfile { tracks: string[]; ambience?: string; direction: string; }
export interface ArenaAudioProfile { profile: string; tracks?: string[]; ambience?: string; overrides?: Partial<Record<MusicState,string[]>>; }
const track = (id: string, profile: string): MusicTrack => ({id, profile, gain:.65, loop:true});
// Optional future profiles remain silent until authored assets are supplied.
export const tracks: Record<string, MusicTrack> = Object.fromEntries([
  ['menu_01','menu'], ['selection_01','menu'], ['battle_01','urban'],
  ['rooftop_01','urban'], ['rooftop_02','urban'], ['championship_01','event'],
  ['championship_final_01','cinematic'], ['party_01','funk'], ['victory_01','event'], ['defeat_01','event'],
  ['beach_01','tropical'], ['factory_01','industrial'], ['neon_01','neon'],
  ['dojo_01','dojo'], ['forest_01','organic'], ['ice_01','ice'],
  ['castle_01','orchestral'], ['horror_01','dark'], ['club_01','club'], ['boss_01','cinematic'],
].map(([id, profile]) => [id, track(id, profile)]));
// Original score, reproducibly composed in scripts/create-soundtrack.py.
const supplied:Record<string,[string,number,boolean]>={
 menu_01:['menu',108,true],selection_01:['menu',120,true],rooftop_01:['urban',128,true],rooftop_02:['urban',124,true],
 court_01:['court',98,true],mall_01:['mall',116,true],church_01:['church',106,true],party_01:['funk',118,true],
 championship_01:['event',132,true],championship_final_01:['cinematic',144,true],sudden_01:['cinematic',156,true],
 victory_01:['event',120,false],defeat_01:['event',90,false],
};
for(const [id,[profile,bpm,loop]] of Object.entries(supplied))tracks[id]={id,profile,bpm,loop,gain:.65,url:`/audio/music/${id}.wav`};
// User-supplied Abroz Main Menu Theme v8; shared ID keeps menus continuous.
tracks.menu_01={id:'menu_01',profile:'menu',gain:.65,loop:true,url:'/audio/music/abroz-main-menu-theme-v8.mp3'};
tracks.battle_01={...tracks.rooftop_01,id:'battle_01'};
// User-supplied Rooftop theme; keep the generic battle fallback independent.
tracks.rooftop_01={id:'rooftop_01',profile:'urban',gain:.65,loop:true,url:'/audio/music/rooftop-sunset-showdown.mp3'};
// User-supplied Church theme, preserved byte-for-byte.
tracks.church_01={id:'church_01',profile:'church',gain:.65,loop:true,url:'/audio/music/ceremonial-steel.mp3'};
// User-supplied Mall theme, preserved byte-for-byte.
tracks.mall_01={id:'mall_01',profile:'mall',gain:.65,loop:true,url:'/audio/music/mall-theme.mp3'};
// User-supplied Basketball Court theme, preserved byte-for-byte.
tracks.court_01={id:'court_01',profile:'court',gain:.65,loop:true,url:'/audio/music/basketball-court-theme.mp3'};
// User-supplied victory screen song, preserved byte-for-byte.
tracks.victory_01={id:'victory_01',profile:'event',gain:.65,loop:false,url:'/audio/music/victory-theme.mp3'};
for(const id of ['battle_01','rooftop_01','rooftop_02','court_01','mall_01','church_01']){
 tracks[id].finalVersion='championship_final_01';tracks[id].suddenDeathVersion='sudden_01';
}
export const musicProfiles: Record<string, MusicProfile> = {
  urban: {tracks:['rooftop_01','rooftop_02'], direction:'Warm breakbeat, hip-hop drums and electronic bass; energetic rooftop street fight.'},
  tropical: {tracks:['beach_01'],direction:'Percussion and funky bass; active tropical combat.'},
  industrial: {tracks:['factory_01'],direction:'Metal percussion and aggressive electronic rhythm.'},
  neon: {tracks:['neon_01'],direction:'Synths, drum and bass, night-city energy.'},
  dojo: {tracks:['dojo_01'],direction:'Traditional timbres with modern drums and rock.'},
  organic: {tracks:['forest_01'],direction:'Organic percussion with electronic pulse.'},
  ice: {tracks:['ice_01'],direction:'Cold synths, bells and driving cinematic drums.'},
  orchestral: {tracks:['castle_01'],direction:'Orchestral melody, heavy drums and modern bass.'},
  dark: {tracks:['horror_01'],direction:'Dark textures and active industrial rhythm.'},
  club: {tracks:['club_01'],direction:'House and dance percussion.'},
  funk: {tracks:['party_01'],direction:'Playful funk with restrained comic accents.'},
  cinematic: {tracks:['boss_01'],direction:'Dramatic percussion, choir textures and electronic bass.'},
};
// Existing stage id is historical: the-foundry is visually The Rooftop, not a factory.
export const arenaAudio: Record<string, ArenaAudioProfile> = {
  'basketball-court': {profile:'court', tracks:['court_01']},
  'shopping-mall': {profile:'mall',tracks:['mall_01']},
  'aeroporto-church': {profile:'church',tracks:['church_01']},
  'the-foundry': {profile:'urban', tracks:['rooftop_01'], ambience:'rooftop_ambience'},
};
export const ambience: Record<string, {url?: string; gain:number}> = {rooftop_ambience:{gain:.15}};
const stateTracks: Partial<Record<MusicState,string[]>> = {
  'championship-final':['championship_final_01','championship_01'], menu:['menu_01'], selection:['menu_01'], championship:['championship_01'], party:['party_01'], victory:['victory_01'], defeat:['defeat_01'],
};
export function chooseMusic(state:MusicState, arena:string, previous?:string, random=Math.random,excluded:ReadonlySet<string>=new Set()):MusicTrack|undefined {
  const a=arenaAudio[arena], profile=musicProfiles[a?.profile];
  const groups=[a?.overrides?.[state],stateTracks[state],a?.tracks,profile?.tracks,['battle_01']];
  for(const group of groups){
    const candidates=(group??[]).map(id=>tracks[id]).filter((t):t is MusicTrack=>!!t?.url&&!excluded.has(t.id));
    if(!candidates.length)continue;
    const pool=candidates.filter(t=>t.id!==previous);const options=pool.length?pool:candidates;
    const base=options[Math.min(options.length-1,Math.floor(random()*options.length))];
    const variant=state==='final'?base.finalVersion:state==='sudden-death'?base.suddenDeathVersion:state==='intro'?base.introVersion:undefined;
    return variant&&tracks[variant]?.url&&!excluded.has(variant)?tracks[variant]:base;
  }
}
