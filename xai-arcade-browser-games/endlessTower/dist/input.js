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
    /**
     * Touch / pen support on the play area. The canvas is split into thirds:
     * hold the left or right third to run, tap the middle third to jump.
     * Any new touch also queues a restart, so tapping retries after Game Over.
     * Mouse pointers are ignored; desktop keeps the keyboard scheme.
     */
    attachTouch(element) {
        const zones = new Map();
        const zoneAt = (event) => {
            const rect = element.getBoundingClientRect();
            const t = (event.clientX - rect.left) / rect.width;
            return t < 1 / 3 ? 'left' : t > 2 / 3 ? 'right' : 'jump';
        };
        const sync = () => {
            const values = [...zones.values()];
            this.setHeld('ArrowLeft', values.includes('left'));
            this.setHeld('ArrowRight', values.includes('right'));
        };
        element.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse')
                return;
            event.preventDefault();
            element.setPointerCapture(event.pointerId);
            const zone = zoneAt(event);
            zones.set(event.pointerId, zone);
            if (zone === 'jump')
                this.jumpQueued = true;
            this.restartQueued = true;
            sync();
        });
        element.addEventListener('pointermove', (event) => {
            if (!zones.has(event.pointerId))
                return;
            const zone = zoneAt(event);
            // Sliding a held thumb between the side thirds switches direction;
            // sliding into the middle does not trigger a jump.
            if (zone !== 'jump')
                zones.set(event.pointerId, zone);
            sync();
        });
        const release = (event) => {
            if (zones.delete(event.pointerId))
                sync();
        };
        element.addEventListener('pointerup', release);
        element.addEventListener('pointercancel', release);
        element.addEventListener('lostpointercapture', release);
    }
    setHeld(code, on) {
        if (on)
            this.held.add(code);
        else
            this.held.delete(code);
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