import type { StageDefinition } from "../types.js";
export const trainingRoom: StageDefinition = {
  id: "the-foundry",
  name: "The Rooftop",
  artwork: "/art/rooftop-city-v1.png",
  theme: "rooftop",
  eideLovePlatforms: [0, 1],
  width: 2400,
  floorHeight: 0,
  platforms: [
    { x: 360, y: 340, width: 480 },
    { x: 1560, y: 340, width: 480 },
  ],
  cameraBounds: [200, 2200],
  background: "#182628",
  lighting: { ambient: 1.4, key: "#dbedbb" },
  music: "foundry",
};
export const basketballCourt: StageDefinition = {
  id: "basketball-court", name: "Basketball Court",
  artwork: "/art/basketball-court-v3.png", theme: "basketball",
  width: 2400, floorHeight: 0,
  platforms: [
    { x: 300, y: 300, width: 480 },
    { x: 1620, y: 300, width: 480 },
    { x: 960, y: 600, width: 480 },
  ],
  eideLovePlatforms: [0, 1],
  cameraBounds: [200, 2200], background: "#182628",
  lighting: { ambient: 1.4, key: "#dbedbb" }, music: "urban",
};
export const shoppingMall: StageDefinition = {
  id: "shopping-mall", name: "Shopping Mall",
  artwork: "/art/shopping-mall-v1.png", theme: "mall",
  width: 2400, floorHeight: 0,
  platforms: [
    {x: 0, y: 300, width: 960, motion: {from: 0, to: 1440, period: 720}},
    {x: 1440, y: 600, width: 960, motion: {from: 0, to: 1440, period: 720, phase: 360}},
  ],
  eideLovePlatforms: [0, 1], cameraBounds: [200, 2200], background: "#292333",
  lighting: {ambient: 1.4, key: "#ffe6c4"}, music: "urban",
};
export const aeroportoChurch: StageDefinition = {
  id: "aeroporto-church", name: "Aeroporto Church",
  artwork: "/art/aeroporto-church-v3.png", theme: "church",
  width: 2400, floorHeight: 0,
  platforms: [{x: 720, y: 340, width: 960}],
  eideLovePlatforms: [0, 0], eideLoveOffsets: [.25, .75],
  cameraBounds: [200, 2200], background: "#333c46",
  lighting: {ambient: 1.4, key: "#f3e6d1"}, music: "foundry",
};
export const stages: Record<string, StageDefinition> = {
  [trainingRoom.id]: trainingRoom,
  [basketballCourt.id]: basketballCourt,
  [shoppingMall.id]: shoppingMall,
  [aeroportoChurch.id]: aeroportoChurch,
};
