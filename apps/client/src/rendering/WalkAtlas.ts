export type WalkCharacter = "tocha" | "bozo" | "gut" | "clone" | "spear";
export interface WalkFrame {atlas:number;bounds:number[];pivot:number;height:number;lead:string;phase:string;grips?:number[]}
export interface WalkAtlas {height:number;sources:{path:string;width:number;height:number}[];frames:WalkFrame[]}
export const walkAtlases:Record<WalkCharacter,WalkAtlas> = {
  "tocha": {
    "height": 1.74,
    "sources": [
      {
        "path": "/art/walk-correction/tocha-near.png",
        "width": 1536,
        "height": 1024
      },
      {
        "path": "/art/walk-correction/tocha-far.png",
        "width": 1536,
        "height": 1024
      }
    ],
    "frames": [
      {
        "atlas": 0,
        "bounds": [
          203,
          12,
          703,
          497
        ],
        "pivot": 448.35,
        "height": 487,
        "lead": "near",
        "phase": "contact"
      },
      {
        "atlas": 0,
        "bounds": [
          943,
          12,
          1208,
          499
        ],
        "pivot": 1051.17,
        "height": 489,
        "lead": "near",
        "phase": "passing"
      },
      {
        "atlas": 1,
        "bounds": [
          213,
          12,
          705,
          501
        ],
        "pivot": 447.49,
        "height": 491,
        "lead": "far",
        "phase": "contact"
      },
      {
        "atlas": 1,
        "bounds": [
          925,
          12,
          1207,
          496
        ],
        "pivot": 1050.94,
        "height": 486,
        "lead": "far",
        "phase": "passing"
      },
      {
        "atlas": 0,
        "bounds": [
          214,
          514,
          720,
          986
        ],
        "pivot": 467.02,
        "height": 474,
        "lead": "near",
        "phase": "contact"
      },
      {
        "atlas": 0,
        "bounds": [
          936,
          515,
          1216,
          992
        ],
        "pivot": 1056.07,
        "height": 479,
        "lead": "near",
        "phase": "passing"
      },
      {
        "atlas": 1,
        "bounds": [
          218,
          515,
          718,
          996
        ],
        "pivot": 465.71,
        "height": 483,
        "lead": "far",
        "phase": "contact"
      },
      {
        "atlas": 1,
        "bounds": [
          923,
          515,
          1215,
          992
        ],
        "pivot": 1056.07,
        "height": 479,
        "lead": "far",
        "phase": "passing"
      }
    ]
  },
  "bozo": {
    "height": 1.64,
    "sources": [
      {
        "path": "/art/bozo/model-walk-near-v1.png",
        "width": 1536,
        "height": 1024
      },
      {
        "path": "/art/bozo/model-walk-far-v1.png",
        "width": 1536,
        "height": 1024
      }
    ],
    "frames": [
      {
        "atlas": 0,
        "bounds": [
          240,
          20,
          723,
          509
        ],
        "pivot": 479.19,
        "height": 491,
        "lead": "near",
        "phase": "contact"
      },
      {
        "atlas": 0,
        "bounds": [
          893,
          19,
          1220,
          510
        ],
        "pivot": 1049.76,
        "height": 493,
        "lead": "near",
        "phase": "passing"
      },
      {
        "atlas": 1,
        "bounds": [
          226,
          7,
          758,
          518
        ],
        "pivot": 489.55,
        "height": 513,
        "lead": "far",
        "phase": "contact"
      },
      {
        "atlas": 1,
        "bounds": [
          858,
          8,
          1215,
          517
        ],
        "pivot": 1039.2,
        "height": 511,
        "lead": "far",
        "phase": "passing"
      },
      {
        "atlas": 0,
        "bounds": [
          240,
          520,
          729,
          999
        ],
        "pivot": 486.52,
        "height": 481,
        "lead": "near",
        "phase": "contact"
      },
      {
        "atlas": 0,
        "bounds": [
          891,
          522,
          1223,
          1005
        ],
        "pivot": 1054.59,
        "height": 485,
        "lead": "near",
        "phase": "passing"
      },
      {
        "atlas": 1,
        "bounds": [
          215,
          508,
          747,
          1007
        ],
        "pivot": 485.58,
        "height": 501,
        "lead": "far",
        "phase": "contact"
      },
      {
        "atlas": 1,
        "bounds": [
          865,
          522,
          1215,
          1009
        ],
        "pivot": 1049.83,
        "height": 489,
        "lead": "far",
        "phase": "passing"
      }
    ]
  },
  "gut": {
    "height": 1.8,
    "sources": [
      {
        "path": "/art/walk-correction/gut-near.png",
        "width": 1536,
        "height": 1024
      },
      {
        "path": "/art/walk-correction/gut-far.png",
        "width": 1536,
        "height": 1024
      }
    ],
    "frames": [
      {
        "atlas": 0,
        "bounds": [
          28,
          13,
          478,
          502
        ],
        "pivot": 246.66,
        "height": 491,
        "lead": "near",
        "phase": "contact"
      },
      {
        "atlas": 0,
        "bounds": [
          570,
          13,
          968,
          504
        ],
        "pivot": 748.54,
        "height": 493,
        "lead": "near",
        "phase": "passing"
      },
      {
        "atlas": 1,
        "bounds": [
          19,
          13,
          491,
          503
        ],
        "pivot": 246.6,
        "height": 492,
        "lead": "far",
        "phase": "contact"
      },
      {
        "atlas": 1,
        "bounds": [
          593,
          13,
          1000,
          502
        ],
        "pivot": 780.66,
        "height": 491,
        "lead": "far",
        "phase": "passing"
      },
      {
        "atlas": 0,
        "bounds": [
          28,
          518,
          480,
          1009
        ],
        "pivot": 247.04,
        "height": 493,
        "lead": "near",
        "phase": "contact"
      },
      {
        "atlas": 0,
        "bounds": [
          570,
          518,
          968,
          1010
        ],
        "pivot": 748.48,
        "height": 494,
        "lead": "near",
        "phase": "passing"
      },
      {
        "atlas": 1,
        "bounds": [
          19,
          519,
          491,
          1007
        ],
        "pivot": 246.72,
        "height": 490,
        "lead": "far",
        "phase": "contact"
      },
      {
        "atlas": 1,
        "bounds": [
          595,
          519,
          1000,
          1007
        ],
        "pivot": 780.72,
        "height": 490,
        "lead": "far",
        "phase": "passing"
      }
    ]
  },
  "spear": {
    "height": 1.8,
    "sources": [
      {
        "path": "/art/walk-correction/spear-near.png",
        "width": 1536,
        "height": 1024
      },
      {
        "path": "/art/walk-correction/spear-far.png",
        "width": 1536,
        "height": 1024
      }
    ],
    "frames": [
      {
        "atlas": 0,
        "bounds": [
          27,
          11,
          497,
          504
        ],
        "pivot": 326.92,
        "height": 495,
        "lead": "near",
        "phase": "contact",
        "grips": [
          243,
          215,
          472,
          74
        ]
      },
      {
        "atlas": 0,
        "bounds": [
          568,
          11,
          1002,
          506
        ],
        "pivot": 831.8,
        "height": 497,
        "lead": "near",
        "phase": "passing",
        "grips": [
          748,
          215,
          977,
          74
        ]
      },
      {
        "atlas": 1,
        "bounds": [
          20,
          13,
          495,
          502
        ],
        "pivot": 325.16,
        "height": 491,
        "lead": "far",
        "phase": "contact",
        "grips": [
          243,
          215,
          472,
          83
        ]
      },
      {
        "atlas": 1,
        "bounds": [
          593,
          13,
          1021,
          502
        ],
        "pivot": 854.16,
        "height": 491,
        "lead": "far",
        "phase": "passing",
        "grips": [
          772,
          215,
          997,
          83
        ]
      },
      {
        "atlas": 0,
        "bounds": [
          26,
          517,
          497,
          1011
        ],
        "pivot": 325.86,
        "height": 496,
        "lead": "near",
        "phase": "contact",
        "grips": [
          241,
          716,
          473,
          583
        ]
      },
      {
        "atlas": 0,
        "bounds": [
          568,
          517,
          1002,
          1013
        ],
        "pivot": 830.74,
        "height": 498,
        "lead": "near",
        "phase": "passing",
        "grips": [
          748,
          716,
          977,
          583
        ]
      },
      {
        "atlas": 1,
        "bounds": [
          19,
          518,
          495,
          1007
        ],
        "pivot": 326.16,
        "height": 491,
        "lead": "far",
        "phase": "contact",
        "grips": [
          241,
          716,
          473,
          583
        ]
      },
      {
        "atlas": 1,
        "bounds": [
          595,
          518,
          1021,
          1008
        ],
        "pivot": 856.1,
        "height": 492,
        "lead": "far",
        "phase": "passing",
        "grips": [
          772,
          716,
          997,
          583
        ]
      }
    ]
  },
  "clone": {
    "height": 1.64,
    "sources": [
      {
        "path": "/art/walk-correction/clone-near.png",
        "width": 1536,
        "height": 1024
      },
      {
        "path": "/art/walk-correction/clone-far.png",
        "width": 1536,
        "height": 1024
      }
    ],
    "frames": [
      {
        "atlas": 0,
        "bounds": [
          59,
          118,
          801,
          911
        ],
        "pivot": 386.56,
        "height": 795,
        "lead": "near",
        "phase": "contact"
      },
      {
        "atlas": 0,
        "bounds": [
          882,
          118,
          1478,
          911
        ],
        "pivot": 1098.06,
        "height": 795,
        "lead": "near",
        "phase": "passing"
      },
      {
        "atlas": 1,
        "bounds": [
          60,
          120,
          801,
          911
        ],
        "pivot": 387.22,
        "height": 793,
        "lead": "far",
        "phase": "contact"
      },
      {
        "atlas": 1,
        "bounds": [
          859,
          119,
          1479,
          911
        ],
        "pivot": 1097.64,
        "height": 794,
        "lead": "far",
        "phase": "passing"
      }
    ]
  }
};
