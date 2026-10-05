# Fausto — look approval

Status: look approved by user on 2026-09-28. Gameplay and animation implementation authorized.
Height: 1.66 m. Match supplied likeness: silver cropped hair, dark eyebrows, brown eyes, trimmed salt-and-pepper beard, natural compact build, narrower neck and modest arms/shoulders; avoid muscular exaggeration. Match the youthful facial skin in the reference photos; gray hair does not imply deep wrinkles or age lines. Keep clean shading without swirling/etched texture, especially on the plain black oversized T-shirt and jeans.
Portrait style: existing Bozo portrait. Fighter model style: existing Gut sprite.
User clarified outfits: Skin 1 black suit and tie; Skin 2 oversized plain black crew-neck T-shirt with dropped shoulders, loose near-elbow sleeves and a relaxed untucked hem, and blue jeans, as corrected by the user. White low-top sneakers complete Skin 2.
Portrait carries a small white origami crane to convey the character's special. Standing sprite has empty hands in guard.
Art generated with built-in image_gen; exact prompts in prompts.json.

## Later implementation, after look approval
- Basics: punch → kick → punch; heavy kick; heavy punch.
- Origami: crouch and visibly fold paper into a figure, then place the finished trap on the ground. Five visual variants: crane, frog, butterfly, fox, flower. Choose randomly using deterministic match state. Remains until an opponent touches/passes over it, then explodes and damages that opponent. Shared mechanic for all variants.
- White Cloud: scratch head to emit stationary light gray cloud at activation position, lasting 5 seconds; enemy movement speed reduced 40% while affected. Cloud must not follow Fausto.
- Ancestry: full samurai outfit and sword for 20 seconds; movement and attack speed +20%. Basic moves replaced with slash → kick → slash; hold Basic 2 for 2 seconds to charge a high-speed, long-distance dash through all opponents in path (delayed slash visual, no projectile); slow heavy sword strike with high damage and knockback. Restore normal appearance/moves after 20 seconds.
- Instant Gray: all opponents across arena immediately get completely white hair for 18 seconds; movement reduced 20%; movement remains available but attacks and abilities unavailable for the duration. White hair visibly indicates the effect throughout.
- Walking: deliberate alternating left/right steps with contact and passing frames. Both legs must visibly walk.
- Unspecified damage and costs remain to be selected during implementation; do not alter existing fighter balance.

Portrait consistency: Skin 2 must be a clothing-only variation of Skin 1, preserving the exact face, head angle, pose, expression, framing and lighting. Only outfit changes to oversized black T-shirt, blue jeans and white sneakers.
