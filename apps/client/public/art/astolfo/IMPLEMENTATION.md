# Astolfo — playable implementation

The user approved both looks. The roster now includes both outfits, alternating-leg walking, basic attacks, both specials and both ultimates. Personality clones match the selected outfit and have separate health bars, autonomous basic attacks, expressions and death effects. Talking and Great Idea use moving speech effects; spiders crawl and jump onto their target. Victory art is included.

## Balance defaults

Values not specified by the user use the existing fighter baseline or initial tuning:

- Maximum health: 1400.
- Basic combo: 48 / 58 / 82 damage; heavy kick 115; heavy punch 100.
- Talking: 300-unit forward reach, 48 damage/second, 2 energy startup plus 20/second. Movement slow: 60%, as requested.
- Spider: 55 impact damage plus 60 poison damage over 3 seconds. At most 16 spiders per owner.
- Sad death: 60% slow for 5 seconds in a 260-unit radius.
- Angry death: 100 burn damage over 5 seconds in a 260-unit radius.
- Clones persist until defeated or their owner is defeated; their specified health, damage and speed multipliers are implemented.
- Great Idea: 250-unit radius, 64 damage/second, 70% slow, 21 seconds. Movement and attacks remain available.

## Validation

- Type checks, lint and all 398 tests pass.
- 181 deterministic move/scenario traces match between V8 and JavaScriptCore.
- Production build passes (existing bundle-size advisory remains).
- Browser practice check: split produces two fighting clones with separate 1400/700 health bars; both ultimates activate; no console errors observed.
- Dedicated move preview: /astolfo-preview.html.

## Art

Images generated using built-in image generation. Assets are saved in this directory; exact generation prompts are in prompts.json. Approved portrait/model images are preserved. walk-far.png is an unused early version; the renderer uses walk-far-v2.png and walk-far-casual.png.

## Approved animation fixes

- Idle uses a steady pose with a subtle 0.3% breathing motion, avoiding the large casual-outfit pose change.
- Dedicated two-frame dash and neutral rising/falling jump art for both outfits. Actual aerial attacks retain their attack pose.
- The crawling spider uses a four-frame dark tarantula atlas matching the placement art.
- Talking emits expanding forward arcs from mouth height instead of circular rings.
- Great Idea animates the mouth on the current pose, including walking and attacks.
- Sad Astolfo moves at 80% normal speed; his attack speed remains normal. Angry bonuses are unchanged.
- New art uses built-in image generation; exact prompts and asset names: fixes-prompts.json.
- Verified updated preview, full 398-test suite, production build and 181 matching cross-engine traces.
