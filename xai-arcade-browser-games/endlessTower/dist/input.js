export class Keyboard {
    held = new Set();
    jumpQueued = false;
    restartQueued = false;
    constructor(target = window) {
        target.addEventListener('keydown', (event) => {
            if (event.code === 'Space' || event.code.startsWith('Arrow')) {
                event.preventDefault();
            }
            if (!this.held.has(event.code)) {
                if (event.code === 'Space')
                    this.jumpQueued = true;
                if (event.code === 'KeyR' || event.code === 'Enter')
                    this.restartQueued = true;
            }
            this.held.add(event.code);
        });
        target.addEventListener('keyup', (event) => {
            this.held.delete(event.code);
        });
    }
    get left() {
        return this.held.has('ArrowLeft');
    }
    get right() {
        return this.held.has('ArrowRight');
    }
    consumeJump() {
        const queued = this.jumpQueued;
        this.jumpQueued = false;
        return queued;
    }
    consumeRestart() {
        const queued = this.restartQueued;
        this.restartQueued = false;
        return queued;
    }
}
//# sourceMappingURL=input.js.map