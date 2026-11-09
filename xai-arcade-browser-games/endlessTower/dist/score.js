import { COMBO_POINTS_PER_SKIP, COMBO_SKIP_MIN, HEIGHT_SCORE_UNIT, PLATFORM_SCORE, } from './constants.js';
export class Score {
    maxHeight = 0;
    heightPoints = 0;
    platformPoints = 0;
    comboPoints = 0;
    platformsLanded = 0;
    combo = 0;
    bestCombo = 0;
    lastIndex = 0;
    popup = null;
    popupLife = 0;
    get total() {
        return this.heightPoints + this.platformPoints + this.comboPoints;
    }
    update(dt, feetY) {
        if (feetY > this.maxHeight) {
            this.maxHeight = feetY;
            this.heightPoints = Math.floor(this.maxHeight / HEIGHT_SCORE_UNIT);
        }
        if (this.popupLife > 0) {
            this.popupLife -= dt;
            if (this.popupLife <= 0)
                this.popup = null;
        }
    }
    onLand(platform) {
        if (platform.ground || platform.index <= this.lastIndex) {
            this.combo = 0;
            this.lastIndex = platform.index;
            return;
        }
        const skipped = platform.index - this.lastIndex - 1;
        this.platformsLanded += 1;
        this.platformPoints += PLATFORM_SCORE;
        if (skipped >= COMBO_SKIP_MIN) {
            this.combo += 1;
            if (this.combo > this.bestCombo)
                this.bestCombo = this.combo;
            const bonus = skipped * COMBO_POINTS_PER_SKIP * this.combo;
            this.comboPoints += bonus;
            this.popup = `COMBO x${this.combo}  +${bonus}`;
            this.popupLife = 1.4;
        }
        else {
            this.combo = 0;
        }
        this.lastIndex = platform.index;
    }
}
//# sourceMappingURL=score.js.map