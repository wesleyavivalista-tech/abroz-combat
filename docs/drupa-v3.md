# Drupa punch and White Buda revision

- Second punch: authored preparation, extension, impact and recovery in both skins; body pivot stays stable as the arm extends.
- White Buda: sharper white/cobalt artwork, with a separate upright punch set. Punches preserve idle height and use uniform scaling.
- Sky beam: narrower halo, stronger core and crisp edges, with charge reduced from 120 to 60 frames (2 to 1 second); recovery reduced from 35 to 22 frames.
- Low kick: startup reduced from 24 to 12 frames; recovery from 27 to 18.
- Continuous White Buda Beam: width 40 to 55 units; damage 12 to 16 per tick; duration 480 to 780 frames (8 to 13 seconds). Existing steering, team protection and no-hitstop behavior retained.
- Protocol 23 synchronizes the changed combat rules online.

## Artwork
Built-in image_gen; full prompts and asset paths in `drupa-v3-prompts.json`.
- `apps/client/public/art/drupa/cross-v3.png`
- `apps/client/public/art/drupa/buda-light-v3.png`
- `apps/client/public/art/drupa/buda-upright-v3.png`

Visual checks covered punch preparation/impact/recovery in both skins, upright giant punches at platform height, sky column and the widened continuous beam. Regression tests cover standing-height preservation, pose transitions, charge timing, beam damage/duration, ground kicks and platform hits.
