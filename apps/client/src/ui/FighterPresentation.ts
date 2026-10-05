import { characters } from "../../../../packages/game-core/characters/registry.js";
export interface FighterPresentation {
  portrait: string;
  victoryPortrait?: string;
  /** Guide framing: full-body artwork is enlarged to end at the knees. */
  guideScale?: number;
  guideThumbnailScale?: number;
  /** Normalize full-body source portraits to the roster’s upper-body framing. */
  previewScale?: number;
  /** Optional framing override for the main-menu cast. */
  homeScale?: number;
  /** Independent crop for the small fighter-selection cards. */
  thumbnailScale?: number;
  thumbnailPositionX?: number;
  rosterScale?: number;
  rosterOffsetX?: number;
  rosterOffsetY?: number;
  previewOffsetY?: number;
  /** Horizontal inset toward the opponent, as a percentage of portrait width. */
  previewInset?: number;
  skins?: Record<string, { portrait: string; previewScale?: number; previewOffsetY?: number; facing?: "left" | "right" }>;
  style: string;
  /** Direction the original portrait is looking. */
  facing: "left" | "right";
}
// Framing calibrated to Caio/Jopa. Preview scales also compensate for source
// canvas aspect ratio; guide/thumbnail scales follow the visible head size.
const presentations: Record<string, FighterPresentation> = {
  nikalz:{rosterScale:1.31,rosterOffsetX:20,rosterOffsetY:0,homeScale:1.44,previewScale:1.31,previewInset:4,guideScale:1.26,thumbnailScale:1.31,guideThumbnailScale:0.9,previewOffsetY:0,portrait:'/art/nikalz/portrait-1.png',victoryPortrait:'/art/nikalz/victory-user-v1.png',style:'FOREHEAD & BEES',facing:'right',skins:{palmeiras:{portrait:'/art/nikalz/portrait-2-painted-hat-v1.png'}}},
  eide:{rosterScale:1.35,rosterOffsetX:-29,rosterOffsetY:0,homeScale:1.32,previewScale:1.2744,guideScale:1.4,thumbnailScale:1.45,guideThumbnailScale:1,previewOffsetY:-1,portrait:'/art/eide/portrait-user-work-v4.png',victoryPortrait:'/art/eide/victory-user-v1.png',style:'APPLIANCES & AMBITION',facing:'right',skins:{gym:{portrait:'/art/eide/portrait-user-gym-v4.png'}}},
  biel:{rosterScale:1.4,rosterOffsetX:-3,rosterOffsetY:0,homeScale:1.32,previewScale:1.28,guideScale:1.4,thumbnailScale:1.45,guideThumbnailScale:1,previewOffsetY:0,portrait:'/art/biel/portrait-user-suit-v2.png',victoryPortrait:'/art/biel/victory-user-v1.png',style:'WINE & LOANS',facing:'right',skins:{casual:{portrait:'/art/biel/portrait-user-casual-v2.png'}}},
  jopa:{rosterScale:1.5,rosterOffsetX:0,rosterOffsetY:0,homeScale:1.52,previewScale:1.25,guideScale:1.4,thumbnailScale:1.4,guideThumbnailScale:1,previewOffsetY:0,portrait:'/art/jopa/portrait-user-santos-v4.png',victoryPortrait:'/art/jopa/victory-user-v1.png',style:'CHESS & FOOTBALL',facing:'right',skins:{casual:{portrait:'/art/jopa/portrait-user-white-v4.png'}}},
  astolfo:{rosterScale:1.3,rosterOffsetX:0,rosterOffsetY:0,homeScale:1.2285,previewScale:1.28,guideScale:1.16,thumbnailScale:1.2,guideThumbnailScale:0.83,previewOffsetY:0,portrait:"/art/astolfo/portrait-user-suit-v3.png",victoryPortrait:"/art/astolfo/victory-user-v1.png",style:"TALK & PERSONALITIES",facing:"right",skins:{casual:{portrait:"/art/astolfo/portrait-user-casual-v3.png"}}},
  fausto:{rosterScale:1.31,rosterOffsetX:0,rosterOffsetY:0,homeScale:1.386,previewScale:1.32,previewInset:4,guideScale:1.26,thumbnailScale:1.31,guideThumbnailScale:0.9,previewOffsetY:-1,portrait:"/art/fausto/portrait-user-suit-v5.png",victoryPortrait:"/art/fausto/victory-user-v1.png",style:"PAPER & ANCESTRY",facing:"right",skins:{casual:{portrait:"/art/fausto/portrait-user-casual-v5.png"}}},
  napa:{rosterScale:1.42,rosterOffsetX:15,rosterOffsetY:0,previewScale:1.34,guideScale:1.47,thumbnailScale:1.52,guideThumbnailScale:1.05,previewOffsetY:0,portrait:"/art/napa/portrait-user-tee-v4.png",victoryPortrait:"/art/napa/victory-user-v1.png",style:"COOKIES & CHAOS",facing:"left",skins:{gym:{portrait:"/art/napa/portrait-user-gym-v4.png"}}},
  jomp:{homeScale:1.3335,rosterScale:1.36,rosterOffsetX:0,rosterOffsetY:0,previewScale:1.27,guideScale:1.22,thumbnailScale:1.26,guideThumbnailScale:0.87,previewOffsetY:0,portrait:'/art/jomp/portrait-user-shirtless-v8.png',victoryPortrait:'/art/jomp/victory-user-v1.png',style:'MUSCLES & ATHLETIC POWER',facing:'right',skins:{charcoal:{portrait:'/art/jomp/portrait-user-charcoal-v8.png',facing:'left'}}},
  dodo:{rosterScale:1.45,rosterOffsetX:-8,rosterOffsetY:-5,homeScale:1.404928,previewScale:1.32,previewInset:-3,guideScale:1.4,thumbnailScale:1.45,guideThumbnailScale:1,previewOffsetY:-3,portrait:'/art/dodo/portrait-user-leaf-v9.png',victoryPortrait:'/art/dodo/victory-user-v1.png',style:'GUITAR & SOUND',facing:'right',skins:{black:{portrait:'/art/dodo/portrait-user-black-v9.png',facing:'left'}}},
  luizinho:{homeScale:1.33812,rosterScale:1.45,rosterOffsetX:-20,rosterOffsetY:-9,previewScale:1.2744,guideScale:1.4,thumbnailScale:1.45,guideThumbnailScale:1,previewOffsetY:-7,portrait:"/art/luizinho/portrait-user-white-v6.png",victoryPortrait:"/art/luizinho/victory-user-v1.png",style:"SELLER & BUILDER",facing:"left",skins:{black:{portrait:"/art/luizinho/portrait-user-black-v6.png",previewOffsetY:-2}}},
  roms:{homeScale:1.281,rosterScale:1.4,rosterOffsetX:0,rosterOffsetY:0,previewScale:1.22,previewInset:2,guideScale:1.35,thumbnailScale:1.4,guideThumbnailScale:0.97,previewOffsetY:0,portrait:"/art/roms/portrait-user-firefighter-v13.png",victoryPortrait:"/art/roms/victory-user-v1.png",style:"AXE & WATER",facing:"left",skins:{hoodie:{portrait:"/art/roms/portrait-user-off-duty-v12.png"}}},
  caio:{rosterScale:1.4,rosterOffsetX:18,rosterOffsetY:0,previewScale:1.2936,guideScale:1.4,thumbnailScale:1.5,guideThumbnailScale:1,previewOffsetY:0,portrait:"/art/caio/portrait-user-blue-v3.png",victoryPortrait:"/art/caio/victory-user-v1.png",style:"SHADOWS & BLOOD",facing:"left",skins:{black:{portrait:"/art/caio/portrait-user-black-v3.png",facing:"right"}}},
  drupa:{rosterScale:1.3,rosterOffsetX:3,rosterOffsetY:-16,previewScale:1.2768,guideScale:1.47,thumbnailScale:1.3,thumbnailPositionX:72,guideThumbnailScale:1.05,previewOffsetY:-16,victoryPortrait:"/art/drupa/victory-user-v1.png",portrait:"/art/drupa/portrait-user-red-v2.png",style:"BELLY & LIGHT",facing:"right",skins:{purple:{portrait:"/art/drupa/portrait-user-purple-v2.png",previewScale:1.26,previewOffsetY:-3}}},
  gut: {rosterScale:1.38,rosterOffsetX:-28,rosterOffsetY:-7,previewScale:1.25,guideScale:1.33,thumbnailScale:1.38,guideThumbnailScale:0.95,previewOffsetY:-6,victoryPortrait:"/art/gut/victory-user-v1.png",portrait:"/art/gut/portrait-user-shirt-v2.png",style:"KUNG FU",facing:"left",skins:{"kung-fu":{portrait:"/art/gut/portrait-user-kung-fu-v2.png",facing:"right"}}},
  bozo: {rosterScale:1.38,rosterOffsetX:-3,rosterOffsetY:-4,previewScale:1.1815,guideScale:1.33,thumbnailScale:1.38,guideThumbnailScale:0.95,previewOffsetY:-2,victoryPortrait:"/art/bozo/victory-user-v1.png",portrait: "/art/bozo/portrait-user-polo-v6.png", style: "BEARD & BODY HAIR", facing: "right", skins: {basketball: {facing: "right", portrait: "/art/bozo/portrait-user-basketball-v6.png"}}},
  tocha: {rosterScale:1.45,rosterOffsetX:-2,rosterOffsetY:-2,previewScale:1.22056,guideScale:1.4,thumbnailScale:1.45,guideThumbnailScale:1,previewOffsetY:0,victoryPortrait:"/art/tocha/victory-user-v1.png",portrait: "/art/tocha/portrait-user-skull-v3.png", style: "FIRE & HEAVY METAL", facing: "right", skins: {shirtless: {portrait: "/art/tocha/portrait-user-shirtless-v2.png", previewScale:1.2848, previewOffsetY:-1}}},
};
export function registerFighterPresentation(id: string, presentation: FighterPresentation): void {
  presentations[id] = presentation;
}
export function fighterPresentation(id: string, skin?: string): FighterPresentation {
  const base = presentations[id] ?? { portrait: "/art/fighter-placeholder.svg", style: characters[id]?.description ?? "FIGHTER", facing: "right" as const };
  const variant = skin ? base.skins?.[skin] : undefined;
  return variant ? { ...base, ...variant } : base;
}
export function escapeMarkup(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
