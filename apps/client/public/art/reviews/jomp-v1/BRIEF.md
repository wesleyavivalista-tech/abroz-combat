# Jomp — visual approval draft
Status: Awaiting user approval of portraits and standing models. No roster/gameplay integration yet.
Height: 1.76 m.
Skin 1: shirtless, beige shorts, black sneakers.
Skin 2: open relaxed charcoal short-sleeve cotton-linen button-up; soft collar, single chest pocket; dark pants; white sneakers.
Reference source: /Users/nicol/Desktop/Abroz fight/Jomp/
Style references: Luizinho portrait-1.png (photographic menu lighting) and movement-1.png (illustrated arcade model). Preview backgrounds remain baked in; remove backgrounds after approval for integration.

## Required later implementation
Walking must visibly alternate BOTH legs, with clear planted-foot and passing-foot phases; match roster proportions and art style. Create all other animations and abilities only after look approval.
Basic 1: punch, punch, kick combo. Basic 2: heavy kick. Basic 3: heavy punch.
Cool muscles: hold button to flex in place with subtle muscle shimmer; cannot move; 80% incoming damage reduction; continuous energy drain; immediate end on release or empty energy.
Investida: American-football charge to opposite arena end; collision damages and knocks opponents to ground.
Gym Bro: select target and home toward them; locked target cannot evade initial grab. Use opponent for 2–3 bicep curls, 2–3 bench presses, 2–3 leg presses (launch up and pull back each repetition), then throw away. Damage every repetition plus final throw; after landing stun for 2 seconds.
Body perfections: four push-ups before Perfect Mode activates; 20 seconds of 40% damage reduction, +50% attack damage, +60% movement speed, +60% attack speed, 4x dash distance, triple jump and subtle body aura. Restore normal abilities and stats on expiry.
Unspecified numerical damage, drain rate and target-selection controls will need balancing when implementing.

## Image generation
Built-in imagegen, four preview assets saved beside this brief.
### Skin 1 menu portrait
Create one NEW photographic fighting-game menu portrait. Images1–3 identity and physique references ONLY. Image4 existing roster portrait STYLE ONLY, do not copy its man's face, clothes, beard or props. Jomp must closely resemble the man in references 1–3: short dark brown close-cropped hair with slightly receding corners, clean-shaven face, straight brows, longish face, defined angular jaw and chin, medium-light warm skin, lean athletic muscular body, height 1.76m. Preserve his individual facial features instead of a generic male model. No sunglasses, headwear, beard, tattoos, medal, necklace or props. Skin 1: shirtless, beige knee-above casual shorts, black athletic sneakers. Confident composed fight-ready expression with a faint closed-mouth smile. Fists raised in a natural boxing guard, body in three-quarter view facing screen-right, distinct bent legs grounded in a combat stance. Match roster's cinematic realistic photography, orange rim light from left and blue rim from right, neutral studio key light. Clean natural skin, no gritty patterned or cracked texture. Head to mid-thigh composition, complete head and hands, subject fills portrait frame. Plain near-black background, no text, no panels. Sharp coherent anatomy, moderate real muscle definition not a bodybuilder caricature.
### Skin 1 standing fighter model
Create ONE full-body standing in-game 2D fighter sprite, not a spritesheet. Images1–3 identity/physique references ONLY. Image4 existing roster SPRITE STYLE reference. Jomp must closely resemble the man in references 1–3: short dark brown close-cropped hair with slightly receding corners, clean-shaven face, straight brows, longish face, defined angular jaw and chin, medium-light warm skin, lean athletic muscular body, height 1.76m. Preserve his individual facial features instead of a generic male model. No sunglasses, headwear, beard, tattoos, medal, necklace or props. Skin 1: shirtless, beige knee-above casual shorts, black athletic sneakers. Confident composed fight-ready expression with a faint closed-mouth smile. Fists raised in a natural boxing guard, body in three-quarter view facing screen-right, distinct bent legs grounded in a combat stance. Match image4's illustrated arcade fighter rendering exactly: adult realistic proportions, medium-sized head, strong dark contour lines, crisp shaded color clusters, restrained painterly/pixel texture, readable at 180–220px game height. NOT photographic, NOT 3D render, NOT chibi, NOT oversized head. Full body head to both black shoes, both feet fully visible, generous empty margin. No aura, no effects, no shadow, no labels. Transparent background. Single isolated standing guard pose.
### Skin 2 clothing-only variants
Clothing-only variant of this Jomp fighter. Preserve the EXACT same person, face, hairstyle, skin tone, muscle proportions, pose, camera, framing, hands, lighting, and rendering style. Change only the outfit: relaxed-fit CHARCOAL GRAY short-sleeve button-up shirt in lightweight textured cotton-linen, soft open collar and a single chest pocket. Shirt fully UNBUTTONED and OPEN, exposing bare chest and abdomen. DARK charcoal full-length pants. WHITE sneakers. No accessories or text. Preserve background. Keep face and skin untouched.



## Background removal review
Removed atmospheric background glow from both portraits and both standing models. Original approved color pixels are preserved via CSS alpha masks generated from the matching image. No gameplay integration in this review.
Prompt: Background removal only. Extract the exact approved character; remove dark background and atmospheric glow to transparent alpha. Preserve pose, face, anatomy, clothes, colors and rim lighting on body. Keep canvas dimensions, position, scale and framing.
Assets: portrait-1-mask.png, portrait-2-mask.png, model-1-mask.png, model-2-mask.png.
