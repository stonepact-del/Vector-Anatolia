import { STEP } from './math';
/** Wall time is scheduling input only. Domain motion always consumes STEP. */
export class FixedStepScheduler {
  private remainder = 0;
  reset() {
    this.remainder = 0;
  }
  advance(elapsedSec: number, speed: number, paused: boolean, advance: () => boolean | void) {
    if (!Number.isFinite(elapsedSec) || elapsedSec < 0)
      throw Error('Invalid scheduler elapsed time.');
    if (paused) {
      this.reset();
      return 0;
    }
    this.remainder += Math.min(elapsedSec, 0.5) * speed;
    let count = 0;
    while (this.remainder + 1e-10 >= STEP) {
      this.remainder = Math.max(0, this.remainder - STEP);
      count++;
      if (advance() === false) {
        this.reset();
        break;
      }
    }
    return count;
  }
}
