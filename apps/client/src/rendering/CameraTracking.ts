import type {PerspectiveCamera} from 'three';

/** Presentation state only: never written back to fighter positions or rollback history. */
export class CameraTracking {
  private aimX?: number;
  private aimY = 0;

  reset(): void { this.aimX = undefined; }

  update(camera: PerspectiveCamera, target: {x: number; y: number; z: number; aimY: number}, dt: number, rate: number, online: boolean): void {
    const smoothing = 1 - Math.exp(-Math.max(0, dt) * rate);
    camera.position.x += (target.x - camera.position.x) * smoothing;
    camera.position.z += (target.z - camera.position.z) * smoothing;
    // Previously lookAt jumped straight to corrected remote positions while the
    // camera itself eased toward them, rotating the entire arena for one frame.
    if (online && this.aimX !== undefined && dt > 0) {
      this.aimX += (target.x - this.aimX) * smoothing;
      this.aimY += (target.aimY - this.aimY) * smoothing;
      camera.position.y += (target.y - camera.position.y) * smoothing;
    } else {
      this.aimX = target.x;
      this.aimY = target.aimY;
      camera.position.y = target.y;
    }
    camera.lookAt(this.aimX, this.aimY, 0);
  }
}
