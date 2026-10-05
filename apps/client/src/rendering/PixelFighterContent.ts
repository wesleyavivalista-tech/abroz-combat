import { crouchAtlas } from "./CrouchAtlas.js";
import { movementAtlases } from "./MovementAtlas.js";
import type { PixelFrame, PixelVisualDefinition } from "./PixelVisualDefinition.js";

// Supplied fighters are content definitions, not special cases in the renderer.
const combatFrames = {
  "prototype-a": [
    [48,19,258,312,153],[366,42,575,312,470],[671,19,880,314,775],[985,19,1205,314,1095],
    [50,382,242,610,146],[367,323,570,614,468],[625,335,914,614,741],[976,332,1247,619,1085],
    [29,637,319,934,112],[372,636,584,866,478],[633,653,967,871,756],[1024,629,1208,934,1113],
    [42,959,286,1230,153],[356,971,589,1230,472],[632,1142,948,1230,790],[1016,939,1208,1237,1112],
  ],
  "prototype-b": [
    [54,36,262,318,158],[362,65,574,318,468],[661,36,895,318,778],[982,36,1207,318,1094],
    [45,401,258,612,152],[363,341,577,613,470],[652,358,927,612,755],[949,356,1244,612,1077],
    [41,654,321,925,128],[399,631,575,875,484],[652,667,964,867,760],[1022,624,1196,927,1110],
    [31,970,302,1226,155],[360,968,600,1222,480],[640,1108,968,1218,804],[1012,933,1217,1226,1115],
  ],
};

const frameMap = (frames: number[][], first = 0): Record<number, PixelFrame> =>
  Object.fromEntries(frames.map((frame, index) => [first + index, frame as unknown as PixelFrame]));

export const pixelFighters: Record<string, PixelVisualDefinition> = Object.fromEntries(
  (["prototype-a", "prototype-b"] as const).map((id, index) => {
    const movement = movementAtlases[id];
    const standingHeight = index ? 1.9 : 1.8;
    const crouchFrames = crouchAtlas.frames.slice(index * 3, index * 3 + 3);
    return [id, {
      animationPoses: { special: index ? 7 : 12 },
      atlases: [
        { url: `/art/${id}-pixel-v1.png`, width: 1254, height: 1254,
          pixelsPerUnit: (index ? 282 : 293) / standingHeight, frames: frameMap(combatFrames[id]) },
        { url: `/art/${id}-movement-v1.png`, width: movement.width, height: movement.height,
          pixelsPerUnit: movement.standingHeight / standingHeight, frames: frameMap(movement.frames, 16) },
        { url: "/art/crouch-attacks-v1.png", width: crouchAtlas.width, height: crouchAtlas.height,
          pixelsPerUnit: (crouchFrames[0][3] - crouchFrames[0][1]) / (index ? 1.42 : 1.4), frames: frameMap(crouchFrames, 24) },
      ],
    }];
  }),
);
