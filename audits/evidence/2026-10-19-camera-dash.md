# Online dash camera reproduction

Used the real SceneRenderer in a browser with two real RollbackManager peers,
real repeated double-tap dash inputs and a deterministic delayed delivery queue.
This is a controlled reproduction, not a recording of the reported live match.
No fighter positions were injected and no production traffic was used.

At 960×540 over 720 frames with 8–10 frames of input delivery delay:
- 53 rollback corrections; both peers converged with desync status OK.
- Before: maximum single-frame displacement of a fixed world point was 31.279 pixels.
- After: 3.140 pixels, approximately 90% lower.
- After with no delivery delay: 2.710 pixels.
- Viewport dimensions remained unchanged.

Cause: camera X/Z eased toward the corrected target, but camera aim snapped
immediately to that target. Online tracking now damps aim and vertical position
using the same time-based response as camera movement. Local tracking retains
its previous transform. Arena changes and initial zero-delta draws reset aim.
Combat positions, controls, hit detection, input delay and rollback are unchanged.

Validation: 53 targeted camera/interpolation/rollback/network tests passed,
including delayed dash convergence, non-mutation of simulation state, local
camera equivalence and consistent smoothing at 30/60/144 FPS. Types, lint and
production build passed (existing bundle-size warning remains).

Detailed logs, temporary reproduction HTML and screenshot are in ignored
`deploy/local/camera-dash/`. No production deployment performed.
