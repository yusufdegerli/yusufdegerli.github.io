export interface GhostFrame {
  x: number;
  y: number;
  facing: -1 | 1;
}

/** Records one run at the fixed update step and plays the previous run back. */
export class GhostRun {
  private current: GhostFrame[] = [];
  private previous: GhostFrame[] | null = null;
  private playback = 0;

  record(frame: GhostFrame): void {
    this.current.push({ x: frame.x, y: frame.y, facing: frame.facing });
  }

  /** Keep the run that just ended. Playback still finishes the older ghost until restart. */
  commitDeath(): void {
    if (this.current.length === 0) return;
    this.previous = this.current;
    this.current = [];
  }

  beginAttempt(): void {
    this.current = [];
    this.playback = 0;
  }

  /** Steps the previous run forward. Holds the last frame, which is where that run died. */
  advance(): GhostFrame | null {
    if (!this.previous || this.previous.length === 0) return null;
    const index = Math.min(this.playback, this.previous.length - 1);
    const frame = this.previous[index];
    if (this.playback < this.previous.length) this.playback += 1;
    return frame;
  }
}
