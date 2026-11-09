const Input = {
  sx: 0,
  sy: 0,
  wx: 0,
  wy: 0,
  keys: Object.create(null),
  buttons: 0,
  inside: false,
  overUi: false,
  drag: null,
  rmb: false,
  wheel: 0,
  clicks: [],
  dbl: false,
  lastClickT: 0,
  lastClickX: 0,
  lastClickY: 0,

  bind(canvas) {
    this.canvas = canvas;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    const down = (e) => this.onDown(e);
    const move = (e) => this.onMove(e);
    const up = (e) => this.onUp(e);
    if (window.PointerEvent) {
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      canvas.addEventListener("pointerleave", () => {
        this.inside = false;
      });
      canvas.addEventListener("pointerenter", () => {
        this.inside = true;
      });
    } else {
      canvas.addEventListener("mousedown", down);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      canvas.addEventListener("mouseleave", () => {
        this.inside = false;
      });
      canvas.addEventListener("mouseenter", () => {
        this.inside = true;
      });
    }
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.wheel += e.deltaY > 0 ? -1 : 1;
      },
      { passive: false }
    );
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener("blur", () => {
      this.keys = Object.create(null);
      this.buttons = 0;
    });
  },

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    this.sx = e.clientX - r.left;
    this.sy = e.clientY - r.top;
    const w = Cam.toWorld(this.sx, this.sy);
    this.wx = w.x;
    this.wy = w.y;
  },

  onDown(e) {
    if (this.canvas.setPointerCapture && e.pointerId != null) {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    this.pos(e);
    this.buttons |= 1 << e.button;
    this.inside = true;
    if (e.button === 0) {
      const t = U.now();
      this.dbl =
        t - this.lastClickT < 0.32 &&
        Math.hypot(this.sx - this.lastClickX, this.sy - this.lastClickY) < 8;
      this.lastClickT = t;
      this.lastClickX = this.sx;
      this.lastClickY = this.sy;
      this.drag = { x0: this.sx, y0: this.sy, x1: this.sx, y1: this.sy, world: false };
    } else if (e.button === 1) {
      Cam.dragging = true;
      Cam.dx = this.sx;
      Cam.dy = this.sy;
    } else if (e.button === 2) {
      this.rmb = true;
    }
  },

  onMove(e) {
    this.pos(e);
    this.inside = true;
    if (this.drag && this.buttons & 1) {
      this.drag.x1 = this.sx;
      this.drag.y1 = this.sy;
      if (Math.hypot(this.drag.x1 - this.drag.x0, this.drag.y1 - this.drag.y0) > 6) {
        this.drag.world = true;
      }
    }
    if (Cam.dragging && this.buttons & 4) {
      Cam.x -= (this.sx - Cam.dx) / Cam.z;
      Cam.y -= (this.sy - Cam.dy) / Cam.z;
      Cam.dx = this.sx;
      Cam.dy = this.sy;
      Cam.clamp();
    }
  },

  onUp(e) {
    this.pos(e);
    if (e.button === 0 && this.drag) {
      this.clicks.push({
        type: "left",
        sx: this.sx,
        sy: this.sy,
        wx: this.wx,
        wy: this.wy,
        shift: e.shiftKey,
        dbl: this.dbl,
        box: this.drag.world ? { ...this.drag } : null,
      });
    } else if (e.button === 2) {
      this.clicks.push({
        type: "right",
        sx: this.sx,
        sy: this.sy,
        wx: this.wx,
        wy: this.wy,
        shift: e.shiftKey,
      });
    }
    if (e.button === 0) this.drag = null;
    if (e.button === 1) Cam.dragging = false;
    if (e.button === 2) this.rmb = false;
    this.buttons &= ~(1 << e.button);
    this.dbl = false;
  },

  down(code) {
    return !!this.keys[code];
  },

  consume() {
    const c = this.clicks;
    this.clicks = [];
    const w = this.wheel;
    this.wheel = 0;
    return { clicks: c, wheel: w };
  },

  boxScreen() {
    if (!this.drag || !this.drag.world) return null;
    const x = Math.min(this.drag.x0, this.drag.x1);
    const y = Math.min(this.drag.y0, this.drag.y1);
    const w = Math.abs(this.drag.x1 - this.drag.x0);
    const h = Math.abs(this.drag.y1 - this.drag.y0);
    return { x, y, w, h };
  },
};
