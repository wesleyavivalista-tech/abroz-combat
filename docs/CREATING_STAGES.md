# Creating a stage

1. Add a `StageDefinition` in `packages/game-core/stages/registry.ts` with an ID, display name, width, floor height, camera bounds, background, lighting and music metadata.
2. Build a renderer adapter like `apps/client/src/rendering/StageRenderer.ts`. Keep collision geometry independent of decorative meshes. Fighters move only along X and jump along Y; Z belongs to presentation.
3. Register the stage's renderer and assets in the client content bootstrap.
4. Pass the selected stage into `GameSimulation` and use the same stage ID in both peers' match configuration.
5. Add the stage to the stage-selection UI and server content allowlist.
6. Test floor contact, both corners, maximum jump height and camera framing at maximum separation.

The shipped prototype has one stage. Its visual adapter is selected directly by SceneRenderer; its gameplay definition is the default constructor parameter for GameSimulation. A larger stage catalog should add the stage ID to the network start protocol before exposing multiple choices online. The stage metadata interface is already separate from Three.js. The current core uses a zero-height gameplay floor; a nonzero presentation floor should be handled by the renderer transform.

The Foundry uses foreground support columns, a raised gridded floor, background wall panels, ventilation fans, lit stripes and directional/rim lighting. Mesh placement creates depth without adding a third movement axis. No general-purpose physics engine is used for combat.

The Foundry is 24 metres wide (2400 simulation units). Starts and training resets use the stage midpoint. StageCoordinates shares the centered presentation transform; the camera fits fighter separation to the viewport and follows the stage camera bounds. Scenery extends beyond the playable floor and fog follows camera zoom.

The Foundry includes two one-way platforms, each 480 units wide at height 340. Define platforms using left-edge x, top y and width in simulation units. Fighters pass upward through decks and land when descending across the top; support is based on their center. Grounded checks apply equally to floor and platforms for movement, normals, blocking and recovery. Jump launch speeds are 22 (Vector) and 21 (Brut).

Normal jumps peak below the decks. Release and press jump again while airborne for one additional jump; landing refreshes it. The airborne allowance is stored in snapshots and resets on respawn. Holding jump does not trigger the second jump.
