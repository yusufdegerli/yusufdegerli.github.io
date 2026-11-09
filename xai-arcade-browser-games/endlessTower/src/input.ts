import type { Controls } from './types.js';

export class Keyboard implements Controls {
  private readonly held = new Set<string>();
  private jumpQueued = false;
  private restartQueued = false;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code.startsWith('Arrow')) {
        event.preventDefault();
      }
      if (!this.held.has(event.code)) {
        if (event.code === 'Space') this.jumpQueued = true;
        if (event.code === 'KeyR' || event.code === 'Enter') this.restartQueued = true;
      }
      this.held.add(event.code);
    });
    target.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
  }

  get left(): boolean {
    return this.held.has('ArrowLeft');
  }

  get right(): boolean {
    return this.held.has('ArrowRight');
  }

  consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  consumeRestart(): boolean {
    const queued = this.restartQueued;
    this.restartQueued = false;
    return queued;
  }
}
