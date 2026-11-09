/** @file Pointer and keyboard input bound to the canvas. */

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.keys = new Set();
    this.mx = 0;
    this.my = 0;
    this.down = false;
    this.button = -1;
    this.drag = null;
    this.wheelY = 0;
    this.listeners = [];
    this.handlers = {};
    this._bind();
  }

  on(name, fn) {
    this.handlers[name] = this.handlers[name] || [];
    this.handlers[name].push(fn);
  }

  emit(name, payload) {
    const list = this.handlers[name];
    if (!list) return;
    for (const fn of list) fn(payload);
  }

  _bind() {
    const c = this.canvas;
    const add = (el, ev, fn, opt) => {
      el.addEventListener(ev, fn, opt);
      this.listeners.push([el, ev, fn, opt]);
    };
    add(c, "pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      const r = c.getBoundingClientRect();
      this.mx = e.clientX - r.left;
      this.my = e.clientY - r.top;
      this.down = true;
      this.button = e.button;
      const tile = this.camera.tileAt(this.mx, this.my);
      this.drag = { x0: tile.x, y0: tile.y, x1: tile.x, y1: tile.y, button: e.button, sx: this.mx, sy: this.my, pan: e.button === 1 || e.altKey };
      this.emit("down", { ...this.drag, mx: this.mx, my: this.my, shift: e.shiftKey });
      e.preventDefault();
    });
    add(c, "pointermove", (e) => {
      const r = c.getBoundingClientRect();
      const nx = e.clientX - r.left;
      const ny = e.clientY - r.top;
      const dx = nx - this.mx;
      const dy = ny - this.my;
      this.mx = nx;
      this.my = ny;
      const tile = this.camera.tileAt(this.mx, this.my);
      if (this.drag) {
        this.drag.x1 = tile.x;
        this.drag.y1 = tile.y;
        if (this.drag.pan || this.drag.button === 1) {
          this.camera.pan(-dx, -dy);
        }
      }
      this.emit("move", { tile, mx: this.mx, my: this.my, drag: this.drag });
    });
    add(c, "pointerup", (e) => {
      const tile = this.camera.tileAt(this.mx, this.my);
      if (this.drag) {
        this.drag.x1 = tile.x;
        this.drag.y1 = tile.y;
        this.emit("up", { ...this.drag, mx: this.mx, my: this.my });
      }
      this.down = false;
      this.drag = null;
      this.button = -1;
    });
    add(c, "pointerleave", () => {
      if (!this.down) this.drag = null;
    });
    add(c, "contextmenu", (e) => e.preventDefault());
    add(c, "wheel", (e) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 0.9 : 1.11;
      this.camera.zoomAt(this.mx, this.my, f);
    }, { passive: false });
    add(window, "keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
      this.emit("key", { key: e.key, down: true, repeat: e.repeat, ev: e });
    });
    add(window, "keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
      this.emit("key", { key: e.key, down: false, ev: e });
    });
    add(window, "blur", () => this.keys.clear());
  }

  held(k) {
    return this.keys.has(k.toLowerCase());
  }

  detach() {
    for (const [el, ev, fn, opt] of this.listeners) el.removeEventListener(ev, fn, opt);
    this.listeners.length = 0;
    this.handlers = {};
    this.keys.clear();
  }
}
