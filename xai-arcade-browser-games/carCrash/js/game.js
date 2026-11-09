/* RIMWRECK — 1v1 demolition soccer. Planck.js / Box2D physics. */
(function () {
  "use strict";

  if (!window.planck) {
    document.body.innerHTML = "<p style='color:#eee;font:16px sans-serif;padding:24px'>Could not load Planck.js. Check your network connection.</p>";
    return;
  }

  var pl = window.planck;
  var Vec2 = pl.Vec2;
  var PlanckWorld = pl.World;
  var Box = pl.Box;
  var Circle = pl.Circle;
  var Edge = pl.Edge;
  var WheelJoint = pl.WheelJoint;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function hypot(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  var W = 800;
  var H = 450;
  var STEP = 1 / 60;
  var VEL_ITERS = 10;
  var POS_ITERS = 8;
  var PPM = 20;
  function M(p) {
    return p / PPM;
  }
  function PX(m) {
    return m * PPM;
  }
  var WIN_SCORE = 5;
  var FLOOR_Y = 424;
  /* Basketball hoop layout — kept for a possible later mode
  var HOOP_MID_Y = (H / 2) | 0;
  var BACKBOARD_H = 100;
  var BACKBOARD_Y = HOOP_MID_Y - ((BACKBOARD_H / 2) | 0);
  var RIM_LINE_Y = BACKBOARD_Y + 50;
  var RIM_Y = RIM_LINE_Y - 2;
  var POLE_Y = BACKBOARD_Y + BACKBOARD_H;
  var POLE_H = FLOOR_Y - POLE_Y;
  */
  var GOAL_H = 92;
  var GOAL_DEPTH = 58;
  var GOAL_POST_W = 6;
  var GOAL_BAR_H = 6;
  var GOAL_TOP = FLOOR_Y - GOAL_H;
  var REPLAY_SECONDS = 3.6;
  var REPLAY_CAP = Math.ceil(REPLAY_SECONDS / STEP);
  var REPLAY_SLOW = 0.3;
  var WHEEL_X = 14;
  var WHEEL_Y = 10;
  var WHEEL_R = 6;
  var CAR_SPAWN_Y = FLOOR_Y - WHEEL_Y - WHEEL_R;
  var VEHICLE_IDS = ["tractor", "monster", "ambulance", "f1", "offroad"];
  var CAT_GROUND = 0x0001;
  var CAT_CAR = 0x0002;
  var CAT_WHEEL = 0x0004;
  var CAT_BALL = 0x0008;
  var CAT_DEBRIS = 0x0010;
  var drawScale = 1;

  var canvas = document.getElementById("game");
  var wrap = document.getElementById("wrap");
  var ctx = canvas.getContext("2d");

  function crisp(c) {
    c.imageSmoothingEnabled = false;
    if ("webkitImageSmoothingEnabled" in c) c.webkitImageSmoothingEnabled = false;
    if ("mozImageSmoothingEnabled" in c) c.mozImageSmoothingEnabled = false;
    if ("msImageSmoothingEnabled" in c) c.msImageSmoothingEnabled = false;
  }
  crisp(ctx);

  /* ---------- input ---------- */
  var keys = Object.create(null);
  var just = Object.create(null);

  window.addEventListener("keydown", function (e) {
    if (!keys[e.code]) just[e.code] = true;
    keys[e.code] = true;
    if (
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "Space" ||
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight" ||
      e.code === "Enter" ||
      e.code === "NumpadEnter" ||
      e.code === "Escape"
    ) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", function (e) {
    keys[e.code] = false;
  });

  function down(code) {
    return !!keys[code];
  }

  function pressed(code) {
    if (!just[code]) return false;
    just[code] = false;
    return true;
  }

  /* ---------- audio ---------- */
  var audio = {
    ctx: null,
    muted: false,
    engines: [null, null],
    boot: function () {
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") this.ctx.resume();
      } catch (err) {
        this.ctx = null;
      }
    },
    tone: function (freq, dur, type, vol, slide, delay) {
      if (!this.ctx || this.muted) return;
      var t = this.ctx.currentTime + (delay || 0);
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.gain.setValueAtTime(0.0008, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    noise: function (dur, vol, hp, delay) {
      if (!this.ctx || this.muted) return;
      var n = this.ctx.sampleRate;
      var frames = Math.max(1, Math.floor(n * dur));
      var buf = this.ctx.createBuffer(1, frames, n);
      var data = buf.getChannelData(0);
      var i;
      for (i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = hp || 800;
      filter.Q.value = 0.8;
      var g = this.ctx.createGain();
      var t = this.ctx.currentTime + (delay || 0);
      g.gain.setValueAtTime(0.0008, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.ctx.destination);
      src.start(t);
      src.stop(t + dur);
    },
    thud: function (amt) {
      var a = clamp(amt, 0.2, 1.6);
      this.tone(90 + a * 40, 0.12, "sine", 0.09 * a, 0.3);
      this.noise(0.09, 0.05 * a, 200);
    },
    breakPart: function () {
      this.tone(180, 0.16, "sawtooth", 0.06, 0.25);
      this.noise(0.14, 0.07, 600);
    },
    bounce: function (amt) {
      this.tone(220 + amt * 80, 0.08, "triangle", 0.045, 0.7);
    },
    jump: function () {
      this.tone(260, 0.09, "square", 0.04, 1.6);
    },
    blip: function (kind) {
      this.boot();
      if (kind === "ok") this.tone(720, 0.055, "square", 0.045, 1.15);
      else if (kind === "back") this.tone(196, 0.07, "square", 0.04, 0.55);
      else if (kind === "ready") this.tone(520, 0.07, "square", 0.045, 1.4);
      else this.tone(392, 0.032, "square", 0.03, 1);
    },
    crowd: function (kind) {
      this.boot();
      if (!this.ctx || this.muted) return;
      var t0 = this.ctx.currentTime;
      var cheer = kind === "cheer";
      var bursts = cheer ? 10 : 4;
      var i, delay, freq, dur, vol;
      for (i = 0; i < bursts; i++) {
        delay = cheer ? i * 0.07 : i * 0.04;
        freq = (cheer ? 280 : 500) + Math.random() * (cheer ? 900 : 700);
        dur = cheer ? 0.28 + Math.random() * 0.35 : 0.12 + Math.random() * 0.1;
        vol = (cheer ? 0.045 : 0.055) * (0.7 + Math.random() * 0.5);
        this.tone(freq, dur, Math.random() > 0.5 ? "sawtooth" : "triangle", vol, cheer ? 1.25 : 1.7, delay);
        this.noise(dur * 0.85, vol * 0.9, cheer ? 400 + i * 50 : 900, delay);
      }
      if (cheer) {
        this.noise(1.4, 0.1, 250);
        this.tone(196, 0.6, "sine", 0.04, 1.2);
      } else {
        this.noise(0.35, 0.08, 900);
      }
    },
    goal: function () {
      var self = this;
      this.tone(392, 0.12, "square", 0.07, 1);
      setTimeout(function () { self.tone(523, 0.12, "square", 0.07, 1); }, 110);
      setTimeout(function () { self.tone(659, 0.18, "square", 0.08, 1); }, 220);
      setTimeout(function () { self.tone(784, 0.28, "triangle", 0.07, 1.1); }, 360);
    },
    win: function () {
      this.tone(523, 0.15, "square", 0.07, 1);
      var self = this;
      setTimeout(function () { self.tone(659, 0.15, "square", 0.07, 1); }, 140);
      setTimeout(function () { self.tone(784, 0.15, "square", 0.07, 1); }, 280);
      setTimeout(function () { self.tone(1046, 0.4, "triangle", 0.08, 1); }, 420);
    },
    tick: function (cars) {
      if (!this.ctx) return;
      var i, car, e, speed, throttle, moving, target, now;
      now = this.ctx.currentTime;
      for (i = 0; i < 2; i++) {
        car = cars[i];
        speed = hypot(car.body.vx, car.body.vy);
        throttle = car.throttle || 0;
        moving = !this.muted && (Math.abs(throttle) > 0.15 || speed > 55);
        if (!moving) {
          e = this.engines[i];
          if (e) {
            e.gain.gain.cancelScheduledValues(now);
            e.gain.gain.setValueAtTime(0, now);
          }
          continue;
        }
        if (!this.engines[i]) {
          e = {
            osc: this.ctx.createOscillator(),
            gain: this.ctx.createGain()
          };
          e.osc.type = "sawtooth";
          e.osc.frequency.value = 70;
          e.gain.gain.value = 0;
          e.osc.connect(e.gain);
          e.gain.connect(this.ctx.destination);
          e.osc.start();
          this.engines[i] = e;
        }
        e = this.engines[i];
        target = (car.grounded ? 0.014 : 0.007) * (Math.abs(throttle) * 0.85 + speed / 700);
        if (car.stats && car.stats.wrecked) target *= 0.4;
        if (target < 0.001) target = 0;
        e.gain.gain.cancelScheduledValues(now);
        e.gain.gain.setTargetAtTime(target, now, 0.05);
        e.osc.frequency.setTargetAtTime(55 + speed * 0.35 + Math.abs(throttle) * 30, now, 0.08);
      }
    },
    hushEngines: function () {
      var i, e, now;
      if (!this.ctx) return;
      now = this.ctx.currentTime;
      for (i = 0; i < 2; i++) {
        e = this.engines[i];
        if (e) {
          e.gain.gain.cancelScheduledValues(now);
          e.gain.gain.setValueAtTime(0, now);
        }
      }
    }
  };

  /* ---------- 5x7 pixel font ---------- */
  var FONT = {
    " ": [0, 0, 0, 0, 0, 0, 0],
    A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
    E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
    H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
    K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
    T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
    "3": [0x0e, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0e],
    "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    "6": [0x0e, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x0e],
    "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
    ":": [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
    ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x04],
    "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
    "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
    "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
    "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0x00, 0x04],
    "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
    "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
    "v": [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
    "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
    ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08]
  };

  function drawText(c, str, x, y, color, scale) {
    scale = scale || 1;
    c.fillStyle = color;
    var i, j, k, ch, glyph, bit;
    var cx = x;
    for (i = 0; i < str.length; i++) {
      ch = str[i];
      glyph = FONT[ch] || FONT[ch.toUpperCase()] || FONT["?"];
      for (j = 0; j < 7; j++) {
        for (k = 0; k < 5; k++) {
          bit = (glyph[j] >> (4 - k)) & 1;
          if (bit) c.fillRect(cx + k * scale, y + j * scale, scale, scale);
        }
      }
      cx += 6 * scale;
    }
    return cx;
  }

  function textWidth(str, scale) {
    return str.length * 6 * (scale || 1);
  }

  function drawTextCenter(c, str, x, y, color, scale) {
    drawText(c, str, Math.round(x - textWidth(str, scale) / 2), y, color, scale);
  }

  /* ---------- pixel helpers ---------- */
  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  }

  function fillDisk(c, cx, cy, r, color) {
    c.fillStyle = color;
    var r2 = r * r;
    var y, x;
    for (y = -r; y <= r; y++) {
      for (x = -r; x <= r; x++) {
        if (x * x + y * y <= r2) c.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  /* ---------- palettes ---------- */
  var PAL_P1 = {
    mid: "#2aa0d8",
    dark: "#0f4a6e",
    light: "#7ad4f0",
    accent: "#e8f6ff",
    stripe: "#f0d060",
    window: "#102838",
    crack: "#081018",
    metal: "#6a7280",
    name: "CYAN"
  };
  var PAL_P2 = {
    mid: "#d83a2a",
    dark: "#6e140f",
    light: "#f08070",
    accent: "#f8d030",
    stripe: "#f8d030",
    window: "#301418",
    crack: "#180808",
    metal: "#6a7280",
    name: "CRIMSON"
  };

  /* ---------- vehicle roster ---------- */
  var VEHICLES = {
    tractor: {
      id: "tractor",
      name: "TRACTOR",
      chassis: { hw: 15, hh: 6, ox: -2, oy: -9 },
      cabin: { hw: 8, hh: 7, ox: -10, oy: -20 },
      bumperFront: { hw: 3, hh: 4, ox: 22, oy: 2 },
      bumperRear: { hw: 4, hh: 6, ox: -22, oy: -2 },
      wheelFront: { x: 18, y: 12, r: 5, style: "street" },
      wheelRear: { x: -12, y: 4, r: 13, style: "tractor" },
      hood: { lx: 12, ly: -10, hw: 10, hh: 5 },
      roof: { lx: -10, ly: -20, hw: 8, hh: 5 },
      spoiler: { lx: 8, ly: -22, hw: 3, hh: 8 },
      sideSkirt: { lx: -4, ly: 2, hw: 8, hh: 3 },
      exhaust: { lx: 8, ly: -24, hw: 3, hh: 8 },
      density: 2.05,
      wheelDensity: 1.15,
      wheelFric: 1.95,
      suspHz: 3.7,
      suspDamp: 0.92,
      motorTorque: 36,
      maxOmega: 34,
      drive: 0.72,
      jump: 0.62,
      air: 0.5,
      grip: 1.28,
      linearDamping: 0.2,
      angularDamping: 1.25,
      gunX: -8,
      gunY: -28,
      exhaustX: 8,
      exhaustY: -30,
      collectR: 30,
      hp: 110
    },
    monster: {
      id: "monster",
      name: "MONSTER",
      chassis: { hw: 15, hh: 6, ox: 0, oy: -20 },
      bumperFront: { hw: 6, hh: 5, ox: 20, oy: -16 },
      bumperRear: { hw: 4, hh: 5, ox: -20, oy: -16 },
      wheelFront: { x: 16, y: 2, r: 14, style: "monster" },
      wheelRear: { x: -16, y: 2, r: 14, style: "monster" },
      hood: { lx: 8, ly: -24, hw: 8, hh: 4 },
      roof: { lx: -2, ly: -28, hw: 8, hh: 4 },
      spoiler: { lx: -14, ly: -28, hw: 5, hh: 3 },
      sideSkirt: { lx: 0, ly: -12, hw: 12, hh: 3 },
      exhaust: { lx: -20, ly: -18, hw: 3, hh: 3 },
      density: 1.55,
      wheelDensity: 1.05,
      wheelFric: 1.75,
      suspHz: 2.7,
      suspDamp: 0.52,
      motorTorque: 34,
      maxOmega: 44,
      drive: 0.95,
      jump: 1.35,
      air: 0.85,
      grip: 1.05,
      linearDamping: 0.14,
      angularDamping: 0.85,
      gunX: 0,
      gunY: -32,
      exhaustX: -20,
      exhaustY: -18,
      collectR: 34,
      hp: 100
    },
    ambulance: {
      id: "ambulance",
      name: "AMBULANCE",
      chassis: { hw: 24, hh: 12, ox: -1, oy: -12 },
      bumperFront: { hw: 4, hh: 5, ox: 26, oy: 0 },
      bumperRear: { hw: 4, hh: 8, ox: -28, oy: -6 },
      wheelFront: { x: 16, y: 8, r: 7, style: "street" },
      wheelRear: { x: -16, y: 8, r: 7, style: "street" },
      hood: { lx: 16, ly: -8, hw: 8, hh: 6 },
      roof: { lx: -4, ly: -26, hw: 16, hh: 4 },
      spoiler: { lx: -4, ly: -30, hw: 10, hh: 3 },
      sideSkirt: { lx: 0, ly: 4, hw: 18, hh: 2 },
      exhaust: { lx: -28, ly: 2, hw: 3, hh: 2 },
      density: 1.42,
      wheelDensity: 0.9,
      wheelFric: 1.45,
      suspHz: 4.4,
      suspDamp: 0.86,
      motorTorque: 24,
      maxOmega: 50,
      drive: 0.88,
      jump: 0.85,
      air: 0.7,
      grip: 1.0,
      linearDamping: 0.16,
      angularDamping: 1.05,
      gunX: -2,
      gunY: -32,
      exhaustX: -28,
      exhaustY: 2,
      collectR: 32,
      hp: 95
    },
    f1: {
      id: "f1",
      name: "FORMULA",
      chassis: { hw: 12, hh: 3, ox: 0, oy: -2 },
      nose: { hw: 8, hh: 2, ox: 18, oy: 0 },
      bumperFront: { hw: 4, hh: 2, ox: 28, oy: 1 },
      bumperRear: { hw: 3, hh: 3, ox: -20, oy: 0 },
      wheelFront: { x: 20, y: 5, r: 4, style: "slick" },
      wheelRear: { x: -20, y: 5, r: 5, style: "slick" },
      hood: { lx: 16, ly: -2, hw: 10, hh: 3 },
      roof: { lx: 0, ly: -8, hw: 6, hh: 3 },
      spoiler: { lx: -22, ly: -10, hw: 8, hh: 2 },
      sideSkirt: { lx: 0, ly: 3, hw: 12, hh: 2 },
      exhaust: { lx: -16, ly: 2, hw: 3, hh: 2 },
      density: 0.82,
      wheelDensity: 0.55,
      wheelFric: 1.32,
      suspHz: 7.4,
      suspDamp: 0.94,
      motorTorque: 16,
      maxOmega: 84,
      drive: 1.28,
      jump: 0.72,
      air: 1.15,
      grip: 0.88,
      linearDamping: 0.08,
      angularDamping: 0.7,
      gunX: 0,
      gunY: -14,
      exhaustX: -16,
      exhaustY: 2,
      collectR: 28,
      hp: 70
    },
    offroad: {
      id: "offroad",
      name: "4X4",
      chassis: { hw: 18, hh: 7, ox: 0, oy: -11 },
      bumperFront: { hw: 5, hh: 6, ox: 22, oy: -6 },
      bumperRear: { hw: 4, hh: 6, ox: -24, oy: -6 },
      wheelFront: { x: 15, y: 6, r: 8, style: "knobby" },
      wheelRear: { x: -15, y: 6, r: 8, style: "knobby" },
      hood: { lx: 10, ly: -14, hw: 8, hh: 4 },
      roof: { lx: -4, ly: -20, hw: 9, hh: 4 },
      spoiler: { lx: -22, ly: -10, hw: 5, hh: 5 },
      sideSkirt: { lx: 0, ly: -2, hw: 16, hh: 3 },
      exhaust: { lx: -22, ly: 0, hw: 3, hh: 2 },
      density: 1.48,
      wheelDensity: 1.0,
      wheelFric: 1.88,
      suspHz: 3.3,
      suspDamp: 0.68,
      motorTorque: 30,
      maxOmega: 52,
      drive: 0.98,
      jump: 1.12,
      air: 0.8,
      grip: 1.22,
      linearDamping: 0.15,
      angularDamping: 0.95,
      gunX: -2,
      gunY: -26,
      exhaustX: -22,
      exhaustY: 0,
      collectR: 30,
      hp: 100
    }
  };

  function vehicleContact(spec) {
    var f = spec.wheelFront.y + spec.wheelFront.r;
    var r = spec.wheelRear.y + spec.wheelRear.r;
    return f > r ? f : r;
  }

  function spawnYFor(spec) {
    return FLOOR_Y - vehicleContact(spec);
  }

  function pickVehiclePair() {
    var forced = /[?&]veh=([^&]+)/.exec(location.search);
    if (forced) {
      var pair = forced[1].split(",");
      return [VEHICLES[pair[0]] ? pair[0] : "tractor", VEHICLES[pair[1]] ? pair[1] : pair[0] && VEHICLES[pair[0]] ? pair[0] : "monster"];
    }
    var ids = VEHICLE_IDS.slice();
    var i, j, t;
    for (i = ids.length - 1; i > 0; i--) {
      j = (Math.random() * (i + 1)) | 0;
      t = ids[i];
      ids[i] = ids[j];
      ids[j] = t;
    }
    return [ids[0], ids[1]];
  }

  /* ---------- game state ---------- */
  var world = null;
  var cars;
  var ball;
  var debris;
  var particles;
  var skids;
  var score;
  var state;
  var stateT;
  var lastScorer;
  var shake;
  var netRipple;
  var time;
  var bgCanvas;
  var debug = /[?&]debug=1/.test(location.search);
  var locked;
  var lastHitSound = 0;
  var physWorld;
  var physContacts;
  var prevBallY = 200;
  var prevBallX = 400;
  var historyBuf = [];
  var replayFrames = [];
  var replayIndex = 0;
  var replayAcc = 0;
  var replayPose = null;
  var goalFlash = 0;
  var pendingWin = false;
  var gaspCD = 0;
  var pickups = [];
  var pickupTimer = 2.5;
  var bullets = [];
  var leftGoalScale = 1;
  var rightGoalScale = 1;
  var leftGoalT = 0;
  var rightGoalT = 0;
  var leftBarFix = null;
  var rightBarFix = null;
  var PU_KINDS = ["shrink", "grow", "reverse", "gun", "goal"];
  var groundBody;
  var menuClock = 0;
  var menu = {
    cursor: 0,
    hover: -1,
    pausedFrom: "play",
    bothReadyT: 0,
    p1: { veh: 0, ready: false },
    p2: { veh: 1, ready: false }
  };
  var mouse = { x: -40, y: -40, clicked: false, down: false };

  function makeParts(spec) {
    spec = spec || VEHICLES.offroad;
    var hp = spec.hp || 90;
    var wf = spec.wheelFront;
    var wr = spec.wheelRear;
    return {
      chassis: { hp: hp, max: hp, attached: true, lx: 0, ly: 0, hw: spec.chassis.hw, hh: spec.chassis.hh, mass: 0 },
      bumperFront: { hp: 34, max: 34, attached: true, lx: spec.bumperFront.ox, ly: spec.bumperFront.oy, hw: spec.bumperFront.hw, hh: spec.bumperFront.hh, mass: 0.45 },
      bumperRear: { hp: 34, max: 34, attached: true, lx: spec.bumperRear.ox, ly: spec.bumperRear.oy, hw: spec.bumperRear.hw, hh: spec.bumperRear.hh, mass: 0.45 },
      hood: { hp: 26, max: 26, attached: true, lx: spec.hood.lx, ly: spec.hood.ly, hw: spec.hood.hw, hh: spec.hood.hh, mass: 0.3 },
      roof: { hp: 24, max: 24, attached: true, lx: spec.roof.lx, ly: spec.roof.ly, hw: spec.roof.hw, hh: spec.roof.hh, mass: 0.28 },
      spoiler: { hp: 14, max: 14, attached: true, lx: spec.spoiler.lx, ly: spec.spoiler.ly, hw: spec.spoiler.hw, hh: spec.spoiler.hh, mass: 0.18 },
      sideSkirt: { hp: 18, max: 18, attached: true, lx: spec.sideSkirt.lx, ly: spec.sideSkirt.ly, hw: spec.sideSkirt.hw, hh: spec.sideSkirt.hh, mass: 0.2 },
      exhaust: { hp: 10, max: 10, attached: true, lx: spec.exhaust.lx, ly: spec.exhaust.ly, hw: spec.exhaust.hw, hh: spec.exhaust.hh, mass: 0.12 },
      wheelFront: { hp: 40, max: 40, attached: true, lx: wf.x, ly: wf.y, r: wf.r, mass: 0.55 },
      wheelRear: { hp: 40, max: 40, attached: true, lx: wr.x, ly: wr.y, r: wr.r, mass: 0.55 }
    };
  }

  function filter(cat, mask) {
    return { categoryBits: cat, maskBits: mask, groupIndex: 0 };
  }

  function attachView(view, plBody) {
    view.pl = plBody;
    view.sync = function () {
      var p = plBody.getPosition();
      var v = plBody.getLinearVelocity();
      view.x = p.x * PPM;
      view.y = p.y * PPM;
      view.angle = plBody.getAngle();
      view.vx = v.x * PPM;
      view.vy = v.y * PPM;
      view.av = plBody.getAngularVelocity();
    };
    view.worldPoint = function (lx, ly) {
      var wpt = plBody.getWorldPoint(Vec2(M(lx), M(ly)));
      return { x: PX(wpt.x), y: PX(wpt.y) };
    };
    view.localPoint = function (wx, wy) {
      var lpt = plBody.getLocalPoint(Vec2(M(wx), M(wy)));
      return { x: PX(lpt.x), y: PX(lpt.y) };
    };
    view.sync();
    return view;
  }

  function addStaticBox(x, y, w, h, name, rest, fric) {
    return groundBody.createFixture({
      shape: new Box(M(w * 0.5), M(h * 0.5), Vec2(M(x + w * 0.5), M(y + h * 0.5)), 0),
      friction: fric,
      restitution: rest,
      filter: filter(CAT_GROUND, 0xffff),
      userData: { kind: "static", name: name }
    });
  }

  function createPhysWorld() {
    physWorld = new PlanckWorld({ gravity: { x: 0, y: 16 } });
    physContacts = [];
    groundBody = physWorld.createBody();
    physWorld.on("post-solve", function (contact) {
      if (!contact.isTouching()) return;
      var fa = contact.getFixtureA();
      var fb = contact.getFixtureB();
      var wm = contact.getWorldManifold();
      if (!wm || !wm.points || !wm.points.length) return;
      var pt = wm.points[0];
      var n = wm.normal;
      var va = fa.getBody().getLinearVelocityFromWorldPoint(pt);
      var vb = fb.getBody().getLinearVelocityFromWorldPoint(pt);
      var rel = (va.x - vb.x) * n.x + (va.y - vb.y) * n.y;
      physContacts.push({
        ua: fa.getUserData(),
        ub: fb.getUserData(),
        bodyA: fa.getBody(),
        bodyB: fb.getBody(),
        px: PX(pt.x),
        py: PX(pt.y),
        nx: n.x,
        ny: n.y,
        impactVel: rel * PPM
      });
    });
  }

  function buildArena() {
    addStaticBox(0, 0, W, 16, "ceiling", 0.35, 0.4);
    addStaticBox(0, FLOOR_Y, W, 26, "floor", 0.28, 0.85);
    addStaticBox(0, 0, 16, H, "wall", 0.4, 0.45);
    addStaticBox(784, 0, 16, H, "wall", 0.4, 0.45);

    /* Basketball fixtures — disabled while the mode is soccer
    addStaticBox(16, BACKBOARD_Y, 10, BACKBOARD_H, "backboard", 0.62, 0.3);
    addStaticBox(18, POLE_Y, 6, POLE_H, "pole", 0.3, 0.5);
    addStaticBox(80, RIM_Y, 7, 7, "rim", 0.55, 0.25);
    addStaticBox(774, BACKBOARD_Y, 10, BACKBOARD_H, "backboard", 0.62, 0.3);
    addStaticBox(776, POLE_Y, 6, POLE_H, "pole", 0.3, 0.5);
    addStaticBox(713, RIM_Y, 7, 7, "rim", 0.55, 0.25);
    */

    leftBarFix = addStaticBox(16, GOAL_TOP, GOAL_DEPTH, GOAL_BAR_H, "crossbar", 0.4, 0.35);
    rightBarFix = addStaticBox(784 - GOAL_DEPTH, GOAL_TOP, GOAL_DEPTH, GOAL_BAR_H, "crossbar", 0.4, 0.35);
  }

  function paintBackground() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = W;
    bgCanvas.height = H;
    var g = bgCanvas.getContext("2d");
    crisp(g);
    var y, x, band, c, i, n;

    var bands = ["#0a0c18", "#0d1020", "#111428", "#161832", "#1a1c38", "#1c1e3a"];
    for (y = 0; y < 300; y++) {
      band = Math.min(bands.length - 1, Math.floor(y / 50));
      g.fillStyle = bands[band];
      g.fillRect(0, y, W, 1);
    }

    g.fillStyle = "#dce6ff";
    for (i = 0; i < 70; i++) {
      x = ((i * 97) % 780) + 10;
      y = ((i * 53) % 210) + 8;
      g.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
    }

    for (i = 0; i < 160; i++) {
      x = 20 + (i * 13) % 760;
      n = 232 + (i * 17) % 48;
      c = i % 3 === 0 ? "#3a2048" : i % 3 === 1 ? "#241838" : "#2a1830";
      g.fillStyle = c;
      g.fillRect(x, n, 5, 300 - n);
      g.fillStyle = i % 4 === 0 ? "#6a3040" : "#2a2038";
      g.fillRect(x + 1, n + 2, 3, 3);
    }

    g.fillStyle = "#14161f";
    g.fillRect(0, 300, W, 124);
    g.fillStyle = "#1a1d28";
    g.fillRect(16, 310, 768, 114);

    g.fillStyle = "#2a2418";
    g.fillRect(16, 392, 768, 32);
    g.fillStyle = "#323040";
    g.fillRect(16, 400, 768, 24);

    for (x = 16; x < 784; x += 2) {
      if (((x * 13 + (x >> 2) * 7) & 15) === 0) {
        g.fillStyle = ((x * 9) & 7) < 3 ? "#2a2c38" : "#3a3c48";
        g.fillRect(x, 400 + ((x * 5) & 7), 1, 1);
      }
    }

    g.fillStyle = "#c8c090";
    g.fillRect(398, 404, 4, 18);
    for (x = 80; x < 740; x += 36) {
      g.fillStyle = "#6a6858";
      g.fillRect(x, 416, 16, 2);
    }

    function brickWall(x, y, w, h) {
      g.fillStyle = "#3a2a24";
      g.fillRect(x, y, w, h);
      var row, col, ox;
      for (row = 0; row < h; row += 6) {
        ox = (row / 6) % 2 === 0 ? 0 : 5;
        for (col = -8; col < w; col += 10) {
          g.fillStyle = ((row + col) * 13) & 8 ? "#4a342c" : "#322420";
          g.fillRect(x + col + ox, y + row, 9, 5);
          g.fillStyle = "#241814";
          g.fillRect(x + col + ox, y + row + 4, 9, 1);
        }
      }
    }
    brickWall(0, 0, 16, H);
    brickWall(784, 0, 16, H);
    g.fillStyle = "#2a2834";
    g.fillRect(0, 0, W, 16);
    g.fillStyle = "#3a3844";
    for (x = 0; x < W; x += 14) g.fillRect(x, 0, 12, 8);

    /* Basketball hoop art — disabled while the mode is soccer
    function hoop(boardX, poleX, rimX, dir) {
      g.fillStyle = "#c8c4b8";
      g.fillRect(boardX, BACKBOARD_Y, 10, BACKBOARD_H);
      g.fillStyle = "#ece8dc";
      g.fillRect(boardX + 1, BACKBOARD_Y + 2, 8, BACKBOARD_H - 4);
      g.fillStyle = "#d83a2a";
      g.fillRect(boardX + 2, BACKBOARD_Y + 26, 6, 40);
      g.fillStyle = "#ece8dc";
      g.fillRect(boardX + 3, BACKBOARD_Y + 36, 4, 20);
      g.fillStyle = "#4a4e58";
      g.fillRect(poleX, POLE_Y, 6, POLE_H);
      g.fillStyle = "#6a6e78";
      g.fillRect(poleX + 1, POLE_Y, 2, POLE_H);
      g.fillStyle = "#e07018";
      var i;
      if (dir > 0) {
        for (i = 0; i < 54; i++) g.fillRect(26 + i, RIM_LINE_Y + (i < 4 || i > 48 ? 0 : 1), 1, i < 4 || i > 48 ? 6 : 3);
      } else {
        for (i = 0; i < 54; i++) g.fillRect(720 + i, RIM_LINE_Y + (i < 4 || i > 48 ? 0 : 1), 1, i < 4 || i > 48 ? 6 : 3);
      }
      g.fillStyle = "#f8b040";
      g.fillRect(rimX, RIM_Y, 7, 7);
      g.fillStyle = "#fff0c0";
      g.fillRect(rimX + 1, RIM_Y + 1, 5, 2);
    }
    hoop(16, 18, 80, 1);
    hoop(774, 776, 713, -1);
    */

    g.fillStyle = "#2a2210";
    g.fillRect(16, 388, 768, 6);
    var ads = ["RIMWRECK", "STEELBALL", "PITSTOP", "NITRO", "CAGE CUP", "WRECK +"];
    for (i = 0; i < ads.length; i++) {
      g.fillStyle = i % 2 === 0 ? "#1a3048" : "#481818";
      g.fillRect(24 + i * 126, 388, 120, 6);
    }
  }

  function Car(opts) {
    this.team = opts.team;
    this.palette = opts.palette;
    this.controls = opts.controls;
    this.spec = VEHICLES[opts.vehicle] || VEHICLES.offroad;
    this.vehId = this.spec.id;
    this.parts = makeParts(this.spec);
    this.kind = "car";
    this.spawnX = opts.x;
    this.spawnY = spawnYFor(this.spec);
    this.spawnAngle = opts.angle || 0;
    this.chassis = null;
    this.wf = null;
    this.wr = null;
    this.jf = null;
    this.jr = null;
    this.body = {};
    this.createPhysics();
    this.wheelSpin = 0;
    this.grounded = false;
    this.groundNX = 0;
    this.groundNY = -1;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.airJumps = 1;
    this.jumpIgnore = 0;
    this.throttle = 0;
    this.flash = 0;
    this.lastHit = -10;
    this.hurtCD = 0;
    this.stats = this.computeStats();
    this.smokeT = 0;
    this.scale = 1;
    this.scaleT = 0;
    this.reversed = false;
    this.reverseT = 0;
    this.hasGun = false;
    this.gunT = 0;
    this.gunCd = 0;
  }

  Car.prototype.createPhysics = function () {
    var self = this;
    var spec = this.spec;
    var ch = physWorld.createBody({
      type: "dynamic",
      position: Vec2(M(this.spawnX), M(this.spawnY)),
      angle: this.spawnAngle,
      bullet: true,
      allowSleep: false,
      linearDamping: spec.linearDamping,
      angularDamping: spec.angularDamping,
      userData: self
    });
    this.chassis = ch;
    this.body = attachView({}, ch);
    this.body.data = this;
    this.body.tag = "car";
    this.rebuildShapes();
    this.createWheels();
  };

  Car.prototype.rebuildShapes = function () {
    var ch = this.chassis;
    var fix = ch.getFixtureList();
    var next;
    while (fix) {
      next = fix.getNext();
      ch.destroyFixture(fix);
      fix = next;
    }
    var p = this.parts;
    var spec = this.spec;
    var s = this.scale || 1;
    var mask = CAT_GROUND | CAT_CAR | CAT_BALL | CAT_DEBRIS | CAT_WHEEL;
    var box = spec.chassis;
    ch.createFixture({
      shape: new Box(M(box.hw * s), M(box.hh * s), Vec2(M((box.ox || 0) * s), M((box.oy || 0) * s)), 0),
      density: spec.density,
      friction: 0.25,
      restitution: 0.04,
      filter: filter(CAT_CAR, mask),
      userData: { kind: "car", part: "chassis", car: this }
    });
    if (spec.cabin) {
      box = spec.cabin;
      ch.createFixture({
        shape: new Box(M(box.hw * s), M(box.hh * s), Vec2(M(box.ox * s), M(box.oy * s)), 0),
        density: spec.density * 0.85,
        friction: 0.22,
        restitution: 0.03,
        filter: filter(CAT_CAR, mask),
        userData: { kind: "car", part: "roof", car: this }
      });
    }
    if (spec.nose) {
      box = spec.nose;
      ch.createFixture({
        shape: new Box(M(box.hw * s), M(box.hh * s), Vec2(M(box.ox * s), M(box.oy * s)), 0),
        density: spec.density * 0.4,
        friction: 0.2,
        restitution: 0.03,
        filter: filter(CAT_CAR, mask),
        userData: { kind: "car", part: "hood", car: this }
      });
    }
    if (p.bumperFront.attached) {
      box = spec.bumperFront;
      ch.createFixture({
        shape: new Box(M(box.hw * s), M(box.hh * s), Vec2(M(box.ox * s), M(box.oy * s)), 0),
        density: 0.2,
        friction: 0.25,
        restitution: 0.04,
        filter: filter(CAT_CAR, mask),
        userData: { kind: "car", part: "bumperFront", car: this }
      });
    }
    if (p.bumperRear.attached) {
      box = spec.bumperRear;
      ch.createFixture({
        shape: new Box(M(box.hw * s), M(box.hh * s), Vec2(M(box.ox * s), M(box.oy * s)), 0),
        density: 0.2,
        friction: 0.25,
        restitution: 0.04,
        filter: filter(CAT_CAR, mask),
        userData: { kind: "car", part: "bumperRear", car: this }
      });
    }
    if (!p.wheelFront.attached && !p.wheelRear.attached) {
      ch.createFixture({
        shape: new Circle(Vec2(0, M(spec.wheelRear.y * s)), M(Math.max(3, spec.wheelRear.r * 0.35) * s)),
        density: 0.4,
        friction: 0.6,
        restitution: 0.02,
        filter: filter(CAT_CAR, mask),
        userData: { kind: "car", part: "chassis", car: this }
      });
    }
  };

  Car.prototype.createWheels = function () {
    this.destroyWheels();
    if (this.parts.wheelFront.attached) {
      this.makeWheel("front");
    }
    if (this.parts.wheelRear.attached) {
      this.makeWheel("rear");
    }
  };

  Car.prototype.makeWheel = function (side) {
    var spec = this.spec;
    var w = side === "front" ? spec.wheelFront : spec.wheelRear;
    var sc = this.scale || 1;
    var lx = w.x * sc;
    var ly = w.y * sc;
    var anchor = this.chassis.getWorldPoint(Vec2(M(lx), M(ly)));
    var wheel = physWorld.createBody({
      type: "dynamic",
      position: anchor,
      allowSleep: false,
      bullet: true,
      linearDamping: 0.05,
      angularDamping: 0.15,
      userData: this
    });
    wheel.createFixture({
      shape: new Circle(M(w.r * sc)),
      density: spec.wheelDensity,
      friction: spec.wheelFric,
      restitution: 0.02,
      filter: filter(CAT_WHEEL, CAT_GROUND | CAT_BALL | CAT_CAR | CAT_DEBRIS | CAT_WHEEL),
      userData: { kind: "wheel", part: side === "front" ? "wheelFront" : "wheelRear", car: this }
    });
    var joint = physWorld.createJoint(
      new WheelJoint(
        {
          motorSpeed: 0,
          maxMotorTorque: spec.motorTorque,
          enableMotor: true,
          frequencyHz: spec.suspHz,
          dampingRatio: spec.suspDamp,
          collideConnected: false
        },
        this.chassis,
        wheel,
        anchor,
        Vec2(0, 1)
      )
    );
    if (side === "front") {
      this.wf = wheel;
      this.jf = joint;
    } else {
      this.wr = wheel;
      this.jr = joint;
    }
  };

  Car.prototype.destroyWheels = function () {
    if (this.jf) {
      physWorld.destroyJoint(this.jf);
      this.jf = null;
    }
    if (this.jr) {
      physWorld.destroyJoint(this.jr);
      this.jr = null;
    }
    if (this.wf) {
      physWorld.destroyBody(this.wf);
      this.wf = null;
    }
    if (this.wr) {
      physWorld.destroyBody(this.wr);
      this.wr = null;
    }
  };

  Car.prototype.destroyWheel = function (part) {
    if (part === "wheelFront") {
      if (this.jf) physWorld.destroyJoint(this.jf);
      if (this.wf) physWorld.destroyBody(this.wf);
      this.jf = null;
      this.wf = null;
    } else if (part === "wheelRear") {
      if (this.jr) physWorld.destroyJoint(this.jr);
      if (this.wr) physWorld.destroyBody(this.wr);
      this.jr = null;
      this.wr = null;
    }
  };

  Car.prototype.setVehicle = function (id) {
    this.spec = VEHICLES[id] || VEHICLES.offroad;
    this.vehId = this.spec.id;
    this.parts = makeParts(this.spec);
    this.spawnY = spawnYFor(this.spec);
    if (this.chassis) {
      this.chassis.setLinearDamping(this.spec.linearDamping);
      this.chassis.setAngularDamping(this.spec.angularDamping);
      this.chassis.setTransform(Vec2(M(this.spawnX), M(this.spawnY)), this.spawnAngle);
      this.chassis.setLinearVelocity(Vec2(0, 0));
      this.chassis.setAngularVelocity(0);
      this.rebuildShapes();
      this.createWheels();
      this.stats = this.computeStats();
      this.body.sync();
    }
  };

  Car.prototype.computeStats = function () {
    var p = this.parts;
    var spec = this.spec;
    var drive = spec.drive;
    var jump = spec.jump;
    var air = spec.air;
    var grip = spec.grip;
    var stability = 1;
    if (!p.wheelRear.attached) {
      drive *= 0.4;
      grip *= 0.48;
      stability *= 0.42;
    }
    if (!p.wheelFront.attached) {
      drive *= 0.7;
      grip *= 0.32;
      stability *= 0.38;
    }
    if (!p.wheelFront.attached && !p.wheelRear.attached) {
      drive *= 0.3;
      grip *= 0.12;
      jump *= 0.55;
    }
    if (!p.spoiler.attached) air *= 0.52;
    if (!p.hood.attached) drive *= 0.9;
    if (!p.bumperFront.attached) drive *= 0.96;
    var ch = Math.max(0, p.chassis.hp) / p.chassis.max;
    drive *= 0.32 + 0.68 * ch;
    jump *= 0.48 + 0.52 * ch;
    air *= 0.55 + 0.45 * ch;
    if (ch < 0.15) {
      drive *= 0.45;
      jump *= 0.4;
      stability *= 0.3;
    }
    return {
      drive: drive,
      jump: jump,
      air: air,
      grip: grip,
      stability: stability,
      wrecked: ch <= 0.02
    };
  };

  Car.prototype.resetPose = function (repair) {
    this.spawnY = spawnYFor(this.spec);
    this.chassis.setTransform(Vec2(M(this.spawnX), M(this.spawnY)), this.spawnAngle);
    this.chassis.setLinearVelocity(Vec2(0, 0));
    this.chassis.setAngularVelocity(0);
    this.body.sync();
    if (repair === "full") {
      this.parts = makeParts(this.spec);
    } else if (repair === "pit") {
      var name, p;
      for (name in this.parts) {
        p = this.parts[name];
        if (name === "wheelFront" || name === "wheelRear") {
          p.attached = true;
          p.hp = p.max;
        } else if (name === "chassis") {
          p.hp = Math.min(p.max, p.hp + p.max * 0.45);
        } else if (!p.attached) {
          if (Math.random() < 0.55) {
            p.attached = true;
            p.hp = p.max * 0.6;
          }
        } else {
          p.hp = Math.min(p.max, p.hp + p.max * 0.2);
        }
      }
    }
    this.scale = 1;
    this.scaleT = 0;
    this.reversed = false;
    this.reverseT = 0;
    this.hasGun = false;
    this.gunT = 0;
    this.gunCd = 0;
    this.rebuildShapes();
    this.createWheels();
    this.stats = this.computeStats();
    this.flash = 0;
    this.airJumps = 1;
    this.hurtCD = 0;
    this.jumpIgnore = 0;
    this.chassis.setAwake(true);
  };

  Car.prototype.setScale = function (s) {
    s = clamp(s, 0.5, 1.7);
    var prev = this.scale || 1;
    this.scale = s;
    this.rebuildShapes();
    this.createWheels();
    if (s > prev) {
      var p = this.chassis.getPosition();
      this.chassis.setTransform(Vec2(p.x, p.y - M(8)), this.chassis.getAngle());
    }
    this.body.sync();
  };

  Car.prototype.takeHit = function (wx, wy, impactVel, nx, ny, partName, otherMass) {
    if (this.hurtCD > 0) return;
    if (time - this.lastHit < 0.45) return;
    var scale = otherMass == null ? 1 : otherMass === Infinity ? 1 : clamp(otherMass / 8, 0.12, 1.35);
    var dmg = Math.max(0, impactVel - 420) * 0.07 * scale;
    if (dmg < 1.8) return;
    this.lastHit = time;
    this.hurtCD = 0.55;
    this.flash = 0.09;

    var local = this.body.localPoint(wx, wy);
    var name = partName;
    if (!name || !this.parts[name] || (!this.parts[name].attached && name !== "chassis")) {
      name = nearestPart(this, local.x, local.y);
    }
    var part = this.parts[name];
    if (!part) part = this.parts.chassis;
    part.hp -= dmg;
    if (dmg > 14) {
      var k;
      for (k in this.parts) {
        if (this.parts[k] !== part && (this.parts[k].attached || k === "chassis")) {
          this.parts[k].hp -= dmg * 0.1;
        }
      }
    }
    burst(wx, wy, 8 + Math.floor(dmg * 0.5), ["#fff4a0", "#ffc030", "#ffe8d0"], 90 + impactVel * 0.2);
    if (impactVel > 220) {
      shake = Math.min(10, shake + impactVel * 0.012);
      if (time - lastHitSound > 0.05) {
        audio.thud(impactVel / 400);
        lastHitSound = time;
      }
    }
    this.detachBroken(nx, ny, impactVel);
    this.stats = this.computeStats();
  };

  Car.prototype.detachBroken = function (nx, ny, impactVel) {
    var name, part, any = false;
    for (name in this.parts) {
      if (name === "chassis") continue;
      part = this.parts[name];
      if (part.attached && part.hp <= 0) {
        part.attached = false;
        spawnDebris(this, name, part, nx, ny, impactVel);
        any = true;
      }
    }
    if (this.parts.chassis.hp < 0) this.parts.chassis.hp = 0;
    if (any) {
      this.rebuildShapes();
      if (!this.parts.wheelFront.attached) this.destroyWheel("wheelFront");
      if (!this.parts.wheelRear.attached) this.destroyWheel("wheelRear");
      audio.breakPart();
      shake = Math.min(10, shake + 2.2);
    }
  };

  function nearestPart(car, lx, ly) {
    var best = "chassis";
    var bestD = 1e9;
    var name, p, d;
    for (name in car.parts) {
      p = car.parts[name];
      if (!p.attached && name !== "chassis") continue;
      d = hypot(lx - p.lx, ly - p.ly);
      if (d < bestD) {
        bestD = d;
        best = name;
      }
    }
    return best;
  }

  function spawnDebris(car, name, part, nx, ny, impactVel) {
    var wp = car.body.worldPoint(part.lx, part.ly);
    var kick = 70 + impactVel * 0.15;
    var plb = physWorld.createBody({
      type: "dynamic",
      position: Vec2(M(wp.x), M(wp.y)),
      angle: car.body.angle,
      bullet: false,
      linearDamping: 0.25,
      angularDamping: 0.4
    });
    var isWheel = name.indexOf("wheel") === 0;
    plb.createFixture({
      shape: isWheel ? new Circle(M(part.r || WHEEL_R)) : new Box(M(part.hw || 5), M(part.hh || 3)),
      density: 0.35,
      friction: 0.55,
      restitution: 0.38,
      filter: filter(CAT_DEBRIS, CAT_GROUND | CAT_BALL | CAT_CAR | CAT_WHEEL | CAT_DEBRIS),
      userData: { kind: "debris", name: name }
    });
    plb.setLinearVelocity(
      Vec2(M(car.body.vx - nx * kick + (Math.random() - 0.5) * 80), M(car.body.vy - ny * kick - 50 - Math.random() * 40))
    );
    plb.setAngularVelocity(car.body.av + (Math.random() - 0.5) * 10);
    var view = attachView({ tag: "debris", data: { kind: "debris", name: name, palette: car.palette, part: part } }, plb);
    debris.push({
      body: view,
      name: name,
      palette: car.palette,
      life: 14,
      r: part.r || WHEEL_R,
      style: isWheel ? (name === "wheelFront" ? car.spec.wheelFront.style : car.spec.wheelRear.style) : "street",
      vehId: car.vehId
    });
    burst(wp.x, wp.y, 14, [car.palette.mid, car.palette.dark, "#c8c4b0"], 140);
  }

  function spawnBall() {
    var plb = physWorld.createBody({
      type: "dynamic",
      position: Vec2(M(400), M(200)),
      bullet: true,
      allowSleep: false,
      linearDamping: 0.03,
      angularDamping: 0.08,
      userData: { kind: "ball" }
    });
    plb.createFixture({
      shape: new Circle(M(19)),
      density: 0.45,
      friction: 0.38,
      restitution: 0.86,
      filter: filter(CAT_BALL, 0xffff),
      userData: { kind: "ball" }
    });
    ball = attachView({ tag: "ball", data: { kind: "ball" } }, plb);
  }

  function resetBall() {
    ball.pl.setTransform(Vec2(M(400), M(200)), 0);
    ball.pl.setLinearVelocity(Vec2(M((Math.random() - 0.5) * 20), 0));
    ball.pl.setAngularVelocity(0);
    ball.sync();
    prevBallY = ball.y;
  }

  function burst(x, y, n, colors, speed) {
    var i, a, s;
    for (i = 0; i < n; i++) {
      a = Math.random() * Math.PI * 2;
      s = speed * (0.25 + Math.random());
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: 0.25 + Math.random() * 0.55,
        max: 0.8,
        color: colors[i % colors.length],
        size: 1 + (Math.random() * 2) | 0,
        g: 400
      });
    }
  }

  function smoke(x, y, heavy) {
    particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y,
      vx: (Math.random() - 0.5) * 16,
      vy: -20 - Math.random() * 30,
      life: 0.4 + Math.random() * 0.5,
      max: 0.9,
      color: heavy ? "#2a2a30" : "#4a4a52",
      size: heavy ? 3 : 2,
      g: -40
    });
  }

  function jumpPressed(car) {
    var j = car.controls.jump;
    if (typeof j === "string") return pressed(j);
    var i;
    for (i = 0; i < j.length; i++) if (pressed(j[i])) return true;
    return false;
  }

  function CarControl(car, dt) {
    var left = down(car.controls.left);
    var right = down(car.controls.right);
    var gas = down(car.controls.up);
    var rev = down(car.controls.down);
    if (car.reversed) {
      var swap = left;
      left = right;
      right = swap;
      swap = gas;
      gas = rev;
      rev = swap;
    }
    if (jumpPressed(car)) car.jumpBuf = 0.1;
    else car.jumpBuf -= dt;

    var b = car.body;
    var st = car.stats;
    var throttle = 0;
    if (gas) throttle += 1;
    if (rev) throttle -= 0.75;
    car.throttle = throttle;

    var steer = (right ? 1 : 0) - (left ? 1 : 0);
    var chassis = car.chassis;
    if (!car.grounded) {
      chassis.applyTorque(steer * 9.5 * st.air, true);
    } else if (steer !== 0) {
      chassis.applyTorque(steer * 3.2 * st.stability, true);
    }

    if (car.grounded) {
      car.airJumps = 1;
      car.coyote = 0.09;
    } else {
      car.coyote -= dt;
    }

    var inverted = Math.cos(b.angle) < -0.2;
    if (car.jumpBuf > 0 && inverted && !st.wrecked) {
      var flipDir = b.angle >= 0 ? -1 : 1;
      chassis.applyLinearImpulse(Vec2(0, -16 * st.jump), chassis.getWorldCenter(), true);
      chassis.applyAngularImpulse(flipDir * 5.2, true);
      chassis.setAngularVelocity(clamp(chassis.getAngularVelocity() + flipDir * 8, -12, 12));
      car.jumpBuf = 0;
      car.jumpIgnore = 0.45;
      audio.jump();
    } else if (car.jumpBuf > 0 && (car.grounded || car.coyote > 0) && !st.wrecked) {
      var J = 24 * st.jump;
      chassis.applyLinearImpulse(Vec2(car.groundNX * J * 0.08, car.groundNY * J), chassis.getWorldCenter(), true);
      car.jumpBuf = 0;
      car.coyote = 0;
      car.grounded = false;
      car.jumpIgnore = 0.7;
      audio.jump();
      var jp = b.worldPoint(0, car.spec.wheelRear.y + car.spec.wheelRear.r);
      burst(jp.x, jp.y, 8, ["#8a8a94", "#c4c0b0"], 80);
    } else if (car.jumpBuf > 0 && car.airJumps > 0 && !car.grounded && !st.wrecked) {
      car.airJumps -= 1;
      car.jumpBuf = 0;
      car.jumpIgnore = 0.55;
      chassis.applyLinearImpulse(Vec2(0, -8 * st.jump), chassis.getWorldCenter(), true);
      if (steer !== 0) chassis.applyAngularImpulse(steer * 1.2 * st.air, true);
      audio.tone(300, 0.08, "square", 0.035, 1.8);
    }

    var maxOmega = car.spec.maxOmega * st.drive;
    var motor = throttle * maxOmega;
    var torque = (car.grounded ? car.spec.motorTorque : 6) * st.drive * st.grip;
    if (st.wrecked) torque *= 0.25;
    if (car.jf && car.jf.setMotorSpeed) {
      car.jf.setMotorSpeed(motor);
      car.jf.setMaxMotorTorque(torque);
      car.jf.enableMotor(true);
    }
    if (car.jr && car.jr.setMotorSpeed) {
      car.jr.setMotorSpeed(motor);
      car.jr.setMaxMotorTorque(torque * 1.15);
      car.jr.enableMotor(true);
    }
    if (!car.grounded && throttle !== 0 && !st.wrecked) {
      var hx = Math.cos(b.angle);
      var hy = Math.sin(b.angle);
      chassis.applyForceToCenter(Vec2(hx * throttle * 14 * st.air, hy * throttle * 14 * st.air), true);
    }

    var ch = car.parts.chassis.hp / car.parts.chassis.max;
    if (ch < 0.7) {
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = ch < 0.25 ? 0.04 : 0.1;
        var sp = car.parts.exhaust.attached
          ? b.worldPoint(car.spec.exhaustX, car.spec.exhaustY)
          : b.worldPoint(-8, -4);
        smoke(sp.x, sp.y, ch < 0.3);
        if (ch < 0.2 && Math.random() < 0.4) {
          burst(sp.x, sp.y, 2, ["#f08020", "#f8c040"], 40);
        }
      }
    }
  }

  /* Basketball scoring helpers — disabled
  function hoopContains(side, x, y) {
    var top = RIM_LINE_Y + 1;
    var bot = RIM_LINE_Y + 15;
    if (y <= top || y >= bot) return false;
    if (side === "left") return x > 34 && x < 70;
    return x > 730 && x < 766;
  }
  */

  function goalMouthTop(side) {
    var sc = side === "left" ? leftGoalScale : rightGoalScale;
    return FLOOR_Y - GOAL_H * sc;
  }

  function goalContains(side, x, y) {
    var top = goalMouthTop(side);
    if (y < top + GOAL_BAR_H + 2 || y > FLOOR_Y - 8) return false;
    if (side === "left") return x > 20 && x < 16 + GOAL_DEPTH;
    return x > 784 - GOAL_DEPTH && x < 780;
  }

  var ballInLeft = false;
  var ballInRight = false;

  function checkScore() {
    if (state !== "play") return;
    var x = ball.x;
    var y = ball.y;
    var inL = goalContains("left", x, y);
    var inR = goalContains("right", x, y);
    if (inL && !ballInLeft && ball.vx < -40 && prevBallX >= 16 + GOAL_DEPTH) {
      scoreGoal(1);
    } else if (inR && !ballInRight && ball.vx > 40 && prevBallX <= 784 - GOAL_DEPTH) {
      scoreGoal(0);
    }
    ballInLeft = inL;
    ballInRight = inR;
    prevBallX = x;
    prevBallY = y;
  }

  function updateCrowdTension() {
    if (state !== "play" || gaspCD > 0) return;
    if (goalContains("left", ball.x, ball.y) || goalContains("right", ball.x, ball.y)) return;
    var closeLeft = ball.y > goalMouthTop("left") - 28 && ball.y < FLOOR_Y && ball.x < 16 + GOAL_DEPTH + 86 && ball.x > 16;
    var closeRight = ball.y > goalMouthTop("right") - 28 && ball.y < FLOOR_Y && ball.x > 784 - GOAL_DEPTH - 86 && ball.x < 784;
    var approaching = (closeLeft && ball.vx < -70) || (closeRight && ball.vx > 70);
    var barHit = false;
    var i, c, name, impact;
    for (i = 0; i < physContacts.length; i++) {
      c = physContacts[i];
      name = (c.ua && c.ua.name) || (c.ub && c.ub.name) || "";
      impact = Math.abs(c.impactVel);
      if (name === "crossbar" && impact > 140) {
        barHit = true;
        break;
      }
    }
    if (barHit || approaching) {
      audio.crowd("gasp");
      gaspCD = 3.6;
    }
  }

  function otherCar(car) {
    return car.team === 0 ? cars[1] : cars[0];
  }

  function randomAttachedPart(car) {
    var names = [];
    var k;
    for (k in car.parts) {
      if (k !== "chassis" && car.parts[k].attached) names.push(k);
    }
    if (!names.length) return "chassis";
    return names[(Math.random() * names.length) | 0];
  }

  function effectDuration() {
    return 5 + Math.random() * 5;
  }

  function setGoalScale(side, scale, dur) {
    scale = scale || 1;
    var top = FLOOR_Y - GOAL_H * scale;
    if (side === "left") {
      if (leftBarFix) {
        groundBody.destroyFixture(leftBarFix);
        leftBarFix = null;
      }
      leftBarFix = addStaticBox(16, top, GOAL_DEPTH, GOAL_BAR_H, "crossbar", 0.4, 0.35);
      leftGoalScale = scale;
      leftGoalT = dur != null ? dur : leftGoalT;
    } else {
      if (rightBarFix) {
        groundBody.destroyFixture(rightBarFix);
        rightBarFix = null;
      }
      rightBarFix = addStaticBox(784 - GOAL_DEPTH, top, GOAL_DEPTH, GOAL_BAR_H, "crossbar", 0.4, 0.35);
      rightGoalScale = scale;
      rightGoalT = dur != null ? dur : rightGoalT;
    }
  }

  function spawnPickup() {
    if (pickups.length >= 2 || state !== "play") return;
    var kind = PU_KINDS[(Math.random() * PU_KINDS.length) | 0];
    var color = Math.random() < 0.5 ? "green" : "red";
    var x = 120 + Math.random() * 560;
    var y = 80 + Math.random() * 250;
    var tries = 0;
    var i;
    var ok;
    while (tries < 8) {
      ok = true;
      for (i = 0; i < pickups.length; i++) {
        if (hypot(pickups[i].x - x, pickups[i].y - y) < 56) ok = false;
      }
      if (ok) break;
      x = 120 + Math.random() * 560;
      y = 80 + Math.random() * 250;
      tries += 1;
    }
    pickups.push({
      x: x,
      y: y,
      kind: kind,
      color: color,
      bob: Math.random() * Math.PI * 2
    });
    audio.tone(880, 0.08, "square", 0.035, 1.4);
  }

  function applyPickup(car, pu) {
    var foe = otherCar(car);
    var green = pu.color === "green";
    var dur = effectDuration();
    var target = green ? foe : car;
    if (pu.kind === "shrink") {
      target.setScale(0.58);
      target.scaleT = dur;
    } else if (pu.kind === "grow") {
      target = green ? car : foe;
      target.setScale(1.55);
      target.scaleT = dur;
    } else if (pu.kind === "reverse") {
      target.reversed = true;
      target.reverseT = dur;
    } else if (pu.kind === "gun") {
      target = green ? car : foe;
      target.hasGun = true;
      target.gunT = dur;
    } else if (pu.kind === "goal") {
      var side = green ? (car.team === 0 ? "right" : "left") : (car.team === 0 ? "left" : "right");
      setGoalScale(side, 1.7, dur);
    }
    burst(pu.x, pu.y, 16, pu.color === "green" ? ["#40e070", "#d0ffd8", "#ffffff"] : ["#ff5050", "#ffd0d0", "#ffffff"], 140);
    audio.tone(pu.color === "green" ? 660 : 220, 0.12, "square", 0.05, pu.color === "green" ? 1.5 : 0.6);
  }

  function updatePickups(dt) {
    pickupTimer -= dt;
    if (pickupTimer <= 0) {
      if (pickups.length < 2) {
        spawnPickup();
        pickupTimer = 3 + Math.random() * 6;
      } else {
        pickupTimer = 0.7;
      }
    }
    var i, pu, ci, car, d;
    for (i = pickups.length - 1; i >= 0; i--) {
      pu = pickups[i];
      pu.bob += dt * 3;
      for (ci = 0; ci < 2; ci++) {
        car = cars[ci];
        d = hypot(car.body.x - pu.x, car.body.y - pu.y);
        if (d < (car.spec.collectR || 26) * (car.scale || 1) + 10) {
          applyPickup(car, pu);
          pickups.splice(i, 1);
          break;
        }
      }
    }
  }

  function updateEffects(dt) {
    var i, car;
    for (i = 0; i < 2; i++) {
      car = cars[i];
      if (car.scaleT > 0) {
        car.scaleT -= dt;
        if (car.scaleT <= 0 && car.scale !== 1) car.setScale(1);
      }
      if (car.reverseT > 0) {
        car.reverseT -= dt;
        if (car.reverseT <= 0) car.reversed = false;
      }
      if (car.gunT > 0) {
        car.gunT -= dt;
        if (car.gunT <= 0) car.hasGun = false;
      }
    }
    if (leftGoalT > 0) {
      leftGoalT -= dt;
      if (leftGoalT <= 0 && leftGoalScale !== 1) setGoalScale("left", 1, 0);
    }
    if (rightGoalT > 0) {
      rightGoalT -= dt;
      if (rightGoalT <= 0 && rightGoalScale !== 1) setGoalScale("right", 1, 0);
    }
  }

  function updateGuns(dt) {
    var i, car, foe, dx, dy, dist, ang, spd, b;
    for (i = 0; i < 2; i++) {
      car = cars[i];
      if (!car.hasGun) continue;
      car.gunCd -= dt;
      foe = otherCar(car);
      dx = foe.body.x - car.body.x;
      dy = foe.body.y - car.body.y;
      dist = hypot(dx, dy);
      if (dist < 175 && dist > 8 && car.gunCd <= 0) {
        car.gunCd = 0.11;
        ang = Math.atan2(dy, dx);
        spd = 420;
        var muzzle = car.body.worldPoint(car.spec.gunX * (car.scale || 1), car.spec.gunY * (car.scale || 1));
        bullets.push({
          x: muzzle.x,
          y: muzzle.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          owner: car.team,
          life: 0.7
        });
        audio.tone(1400, 0.04, "square", 0.03, 0.5);
      }
    }
    for (i = bullets.length - 1; i >= 0; i--) {
      b = bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      foe = cars[1 - b.owner];
      if (hypot(b.x - foe.body.x, b.y - foe.body.y) < 18 * (foe.scale || 1)) {
        foe.takeHit(b.x, b.y, 470, 0, -1, randomAttachedPart(foe), 6);
        burst(b.x, b.y, 6, ["#fff4a0", "#ff8020"], 90);
        bullets.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) bullets.splice(i, 1);
    }
  }

  function clearPowerups() {
    pickups.length = 0;
    bullets.length = 0;
    pickupTimer = 2.5 + Math.random() * 2;
    if (leftGoalScale !== 1) setGoalScale("left", 1, 0);
    if (rightGoalScale !== 1) setGoalScale("right", 1, 0);
    leftGoalT = 0;
    rightGoalT = 0;
  }

  function cloneParts(parts) {
    var out = {};
    var k;
    for (k in parts) {
      out[k] = { hp: parts[k].hp, max: parts[k].max, attached: parts[k].attached };
    }
    return out;
  }

  function snapshotCar(car) {
    return {
      x: car.body.x,
      y: car.body.y,
      angle: car.body.angle,
      wheelSpin: car.wheelSpin,
      flash: car.flash,
      scale: car.scale,
      hasGun: car.hasGun,
      reversed: car.reversed,
      vehId: car.vehId,
      parts: cloneParts(car.parts)
    };
  }

  function snapshotFrame() {
    var i, d, snap, pu, b;
    snap = {
      ball: { x: ball.x, y: ball.y, angle: ball.angle },
      cars: [snapshotCar(cars[0]), snapshotCar(cars[1])],
      leftGoalScale: leftGoalScale,
      rightGoalScale: rightGoalScale,
      pickups: [],
      bullets: [],
      debris: []
    };
    for (i = 0; i < pickups.length; i++) {
      pu = pickups[i];
      snap.pickups.push({ x: pu.x, y: pu.y, kind: pu.kind, color: pu.color, bob: pu.bob });
    }
    for (i = 0; i < bullets.length; i++) {
      b = bullets[i];
      snap.bullets.push({ x: b.x, y: b.y });
    }
    for (i = 0; i < debris.length; i++) {
      d = debris[i];
      snap.debris.push({
        x: d.body.x,
        y: d.body.y,
        angle: d.body.angle,
        name: d.name,
        palette: d.palette,
        r: d.r,
        style: d.style,
        vehId: d.vehId
      });
    }
    return snap;
  }

  function recordHistory() {
    historyBuf.push(snapshotFrame());
    if (historyBuf.length > REPLAY_CAP) historyBuf.shift();
  }

  function celebrateGoal(scorer) {
    var cols = scorer === 0 ? ["#7ad4f0", "#ffffff", "#2aa0d8", "#f0d060", "#ffe8a0"] : ["#f08070", "#ffffff", "#f8d030", "#d83a2a", "#ffe0d0"];
    var i;
    for (i = 0; i < 14; i++) burst(ball.x, ball.y, 10, cols, 220 + i * 18);
    for (i = 0; i < 8; i++) burst(ball.x + (Math.random() - 0.5) * 40, ball.y - Math.random() * 30, 8, cols, 160);
    shake = 16;
    goalFlash = 1;
  }

  function scoreGoal(scorer) {
    score[scorer] += 1;
    lastScorer = scorer;
    pendingWin = score[scorer] >= WIN_SCORE;
    replayFrames = historyBuf.slice();
    replayFrames.push(snapshotFrame());
    replayIndex = 0;
    replayAcc = 0;
    replayPose = replayFrames[replayFrames.length - 1] || snapshotFrame();
    state = "celebrate";
    stateT = 0;
    locked = true;
    celebrateGoal(scorer);
    audio.boot();
    audio.crowd("cheer");
    audio.goal();
    if (pendingWin) audio.win();
  }

  function applyDamageFromContacts() {
    var i, c, impact, ua, ub;
    for (i = 0; i < physContacts.length; i++) {
      c = physContacts[i];
      impact = Math.abs(c.impactVel);
      if (impact < 320) continue;
      tryHit(c.ua, c.ub, c, impact, c.nx, c.ny);
      tryHit(c.ub, c.ua, c, impact, -c.nx, -c.ny);
      if ((c.ua && c.ua.kind === "ball") || (c.ub && c.ub.kind === "ball")) {
        if (impact > 80 && time - lastHitSound > 0.06) {
          audio.bounce(clamp(impact / 400, 0.3, 1.4));
          lastHitSound = time;
        }
      }
    }

    function tryHit(selfUd, otherUd, c, impact, nx, ny) {
      if (!selfUd || !selfUd.car || !selfUd.car.parts) return;
      var car = selfUd.car;
      if (car.hurtCD > 0) return;
      var hitName = otherUd && otherUd.kind === "static" ? otherUd.name : "";
      var otherKind = otherUd ? otherUd.kind : "";
      var landing = hitName === "floor" || hitName === "ramp" || hitName === "platform";
      if (landing) {
        if (car.jumpIgnore > 0) return;
        if (impact < 850) return;
      }
      if (hitName === "wall" && impact < 420) return;
      if (otherKind === "ball" && impact < 300) return;
      if (otherKind === "debris" && impact < 340) return;
      if ((otherKind === "car" || otherKind === "wheel") && impact < 360) return;
      car.takeHit(c.px, c.py, impact, nx, ny, selfUd.part, otherKind === "static" ? Infinity : 8);
    }
  }

  function updateGrounded() {
    var i, j, c, car, nx, ny, n, ln, udA, udB, isSelfWheel, isGround, upx, upy;
    for (i = 0; i < cars.length; i++) {
      car = cars[i];
      car.grounded = false;
      car.groundNX = 0;
      car.groundNY = -1;
      nx = 0;
      ny = 0;
      n = 0;
      for (j = 0; j < physContacts.length; j++) {
        c = physContacts[j];
        udA = c.ua || {};
        udB = c.ub || {};
        isSelfWheel =
          (udA.car === car && udA.kind === "wheel") || (udB.car === car && udB.kind === "wheel");
        isGround =
          (udA.kind === "static" && (udA.name === "floor" || udA.name === "ramp" || udA.name === "platform")) ||
          (udB.kind === "static" && (udB.name === "floor" || udB.name === "ramp" || udB.name === "platform"));
        if (!isSelfWheel || !isGround) continue;
        if (udA.kind === "wheel" && udA.car === car) {
          upx = -c.nx;
          upy = -c.ny;
        } else {
          upx = c.nx;
          upy = c.ny;
        }
        if (upy < -0.2) {
          nx += upx;
          ny += upy;
          n += 1;
        }
      }
      if (n > 0) {
        ln = hypot(nx, ny) || 1;
        car.grounded = true;
        car.groundNX = nx / ln;
        car.groundNY = ny / ln;
      }
    }
  }

  function updateParticles(dt) {
    var i, p;
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (i = skids.length - 1; i >= 0; i--) {
      skids[i].life -= dt;
      if (skids[i].life <= 0) skids.splice(i, 1);
    }
    for (i = debris.length - 1; i >= 0; i--) {
      debris[i].life -= dt;
      if (debris[i].life <= 0 || debris[i].body.y > H + 40) {
        if (debris[i].body.pl) physWorld.destroyBody(debris[i].body.pl);
        debris.splice(i, 1);
      }
    }
  }

  /* ---------- rendering ---------- */
  function drawWheel(c, x, y, spin, pal, attached, r, style) {
    if (!attached) return;
    r = r == null ? WHEEL_R : r;
    style = style || "street";
    var rubber = style === "slick" ? "#1c1c22" : "#12141a";
    fillDisk(c, x, y, r, rubber);
    if (style === "tractor" || style === "monster" || style === "knobby") {
      var n = style === "monster" ? 8 : style === "tractor" ? 10 : 7;
      var i, a, tx, ty, tw, th;
      tw = style === "monster" ? 5 : 3;
      th = style === "tractor" ? 5 : 3;
      for (i = 0; i < n; i++) {
        a = spin + (i / n) * Math.PI * 2;
        tx = Math.round(x + Math.cos(a) * (r - 1));
        ty = Math.round(y + Math.sin(a) * (r - 1));
        px(c, tx - (tw >> 1), ty - (th >> 1), tw, th, "#0a0a10");
      }
    }
    var inner = style === "slick" ? Math.max(2, r - 1) : Math.max(2, r - 3);
    fillDisk(c, x, y, inner, style === "slick" ? "#3a3a44" : "#3a3e48");
    fillDisk(c, x, y, Math.max(1, Math.round(r * 0.28)), style === "slick" ? "#c8a028" : pal.accent);
    var spoke = Math.max(2, Math.round(r * 0.45));
    var sx = Math.round(Math.cos(spin) * spoke);
    var sy = Math.round(Math.sin(spin) * spoke);
    c.fillStyle = "#d0d4dc";
    c.fillRect(x + sx, y + sy, 1, 1);
    c.fillRect(x - sx, y - sy, 1, 1);
    c.fillRect(x - sy, y + sx, 1, 1);
    c.fillRect(x + sy, y - sx, 1, 1);
  }

  function drawCarGadgets(c, spec, gun, rev) {
    if (gun) {
      var gx = spec.gunX;
      var gy = spec.gunY;
      px(c, gx - 3, gy - 5, 6, 9, "#1a1a20");
      px(c, gx - 2, gy - 4, 5, 8, "#3a3a42");
      px(c, gx + 2, gy - 2, 14, 3, "#5a5a64");
      px(c, gx + 14, gy - 3, 5, 2, "#9a9aa4");
      px(c, gx, gy - 1, 3, 3, "#8a2020");
    }
    if (rev) {
      var ry = spec.gunY - 6;
      px(c, -8, ry, 5, 2, "#ffd050");
      px(c, 3, ry, 5, 2, "#ffd050");
      px(c, -9, ry - 1, 2, 4, "#ffd050");
      px(c, 7, ry - 1, 2, 4, "#ffd050");
    }
  }

  function drawDamageCracks(c, dmg, pal) {
    if (dmg > 0.25) {
      px(c, -6, -4, 8, 1, pal.crack);
      px(c, 5, -1, 1, 6, pal.crack);
    }
    if (dmg > 0.5) {
      px(c, -14, 0, 7, 1, pal.crack);
      px(c, 10, 2, 8, 1, pal.crack);
    }
    if (dmg > 0.75) {
      px(c, 2, 1, 5, 3, "#1a1010");
      px(c, -10, -3, 4, 2, "#1a1010");
    }
  }

  function drawVehTractor(c, car, pal, p, dmg, spin) {
    if (p.wheelRear.attached) drawWheel(c, -12, 4, spin, pal, true, 13, "tractor");
    if (p.wheelFront.attached) drawWheel(c, 18, 12, spin * 1.4, pal, true, 5, "street");
    if (p.exhaust.attached) {
      px(c, 7, -32, 4, 22, "#1a1a20");
      px(c, 8, -32, 2, 22, "#2a2a32");
      px(c, 6, -34, 6, 3, "#3a3a44");
      px(c, 7, -35, 4, 2, "#4a4a54");
    }
    if (p.hood.attached) {
      px(c, 2, -14, 22, 12, pal.mid);
      px(c, 4, -15, 18, 2, pal.light);
      px(c, 18, -12, 5, 8, pal.dark);
    } else {
      px(c, 4, -10, 16, 8, pal.dark);
    }
    if (p.roof.attached) {
      px(c, -20, -26, 20, 18, pal.dark);
      px(c, -19, -25, 18, 16, pal.mid);
      px(c, -17, -24, 14, 8, pal.window);
      px(c, -16, -23, 5, 3, "#8ab0c8");
      fillDisk(c, -10, -18, 3, "#2a2a30");
      px(c, -13, -18, 7, 1, pal.metal);
      px(c, -10, -21, 1, 7, pal.metal);
      px(c, 0, -24, 5, 2, pal.metal);
      px(c, 4, -26, 5, 3, pal.window);
      px(c, -22, -24, 4, 2, pal.metal);
      px(c, -25, -26, 5, 3, pal.window);
    } else {
      px(c, -18, -16, 16, 8, pal.dark);
    }
    px(c, -20, -10, 24, 12, pal.mid);
    px(c, -18, -11, 20, 2, pal.light);
    px(c, -8, -6, 14, 3, pal.stripe);
    if (p.sideSkirt.attached) {
      px(c, -8, 0, 6, 1, pal.metal);
      px(c, -8, 3, 6, 1, pal.metal);
      px(c, -9, 0, 1, 4, pal.dark);
      px(c, -6, 6, 8, 2, pal.dark);
    }
    if (p.bumperFront.attached) {
      px(c, 20, 0, 6, 6, pal.metal);
      px(c, 22, 1, 3, 4, pal.light);
    }
    if (p.bumperRear.attached) {
      px(c, -24, -6, 6, 10, pal.dark);
      px(c, -24, -6, 2, 10, pal.metal);
    }
    px(c, 16, -8, 3, 3, car.team === 0 ? "#d8f4ff" : "#ffe8a0");
    px(c, -22, -8, 2, 3, "#ff3030");
    drawDamageCracks(c, dmg, pal);
  }

  function drawVehMonster(c, car, pal, p, dmg, spin) {
    if (p.wheelRear.attached) drawWheel(c, -16, 2, spin, pal, true, 14, "monster");
    if (p.wheelFront.attached) drawWheel(c, 16, 2, spin, pal, true, 14, "monster");
    px(c, -17, -14, 3, 12, "#3a3a44");
    px(c, 14, -14, 3, 12, "#3a3a44");
    px(c, -18, -12, 5, 2, pal.metal);
    px(c, -16, -9, 3, 2, pal.metal);
    px(c, -18, -6, 5, 2, pal.metal);
    px(c, 13, -12, 5, 2, pal.metal);
    px(c, 15, -9, 3, 2, pal.metal);
    px(c, 13, -6, 5, 2, pal.metal);
    px(c, -16, -16, 2, 16, "#2a2a32");
    px(c, 14, -16, 2, 16, "#2a2a32");
    if (p.sideSkirt.attached) {
      px(c, -14, -16, 28, 4, pal.dark);
    }
    px(c, -16, -27, 32, 14, pal.mid);
    px(c, -14, -28, 28, 2, pal.light);
    px(c, -16, -15, 32, 2, pal.dark);
    px(c, -12, -23, 10, 5, "#ff6a18");
    px(c, -8, -25, 8, 4, "#ffd040");
    px(c, 2, -22, 10, 4, pal.stripe);
    px(c, 6, -24, 4, 3, "#ffffff");
    px(c, 4, -21, 8, 2, "#201018");
    if (p.hood.attached) {
      px(c, 4, -27, 14, 8, pal.mid);
      px(c, 6, -28, 10, 2, pal.light);
    }
    if (p.roof.attached) {
      px(c, -10, -32, 16, 6, pal.dark);
      px(c, -8, -33, 12, 2, pal.light);
      px(c, -7, -31, 10, 4, pal.window);
    }
    if (p.spoiler.attached) {
      px(c, -18, -31, 8, 3, pal.dark);
    }
    if (p.bumperFront.attached) {
      px(c, 14, -22, 12, 10, pal.metal);
      px(c, 16, -20, 9, 2, "#c8c8d0");
      px(c, 16, -16, 9, 2, "#c8c8d0");
      px(c, 24, -22, 2, 10, "#8a8a94");
    }
    if (p.bumperRear.attached) {
      px(c, -22, -22, 8, 8, pal.dark);
    }
    if (p.exhaust.attached) {
      px(c, -22, -18, 5, 3, "#2a2c32");
    }
    px(c, 10, -20, 3, 3, car.team === 0 ? "#d8f4ff" : "#ffe8a0");
    px(c, -16, -20, 2, 3, "#ff3030");
    drawDamageCracks(c, dmg, pal);
  }

  function drawVehAmbulance(c, car, pal, p, dmg, spin) {
    if (p.wheelRear.attached) drawWheel(c, -16, 8, spin, pal, true, 7, "street");
    if (p.wheelFront.attached) drawWheel(c, 16, 8, spin, pal, true, 7, "street");
    px(c, -26, -24, 50, 28, "#e8e8ee");
    px(c, -24, -25, 46, 2, "#ffffff");
    px(c, -26, -8, 50, 12, pal.mid);
    px(c, -26, 3, 50, 3, pal.dark);
    px(c, -8, -20, 22, 6, pal.stripe);
    px(c, -26, -12, 50, 4, pal.dark);
    if (p.hood.attached) {
      px(c, 10, -12, 16, 16, "#d0d0d8");
      px(c, 12, -18, 14, 10, pal.window);
      px(c, 14, -16, 6, 4, "#8ab0c8");
    } else {
      px(c, 12, -8, 12, 10, pal.dark);
    }
    if (p.roof.attached) {
      px(c, -22, -28, 38, 5, "#d0d4dc");
    }
    var blink = ((time * 7) | 0) % 2 === 0;
    if (p.spoiler.attached) {
      px(c, -10, -32, 8, 5, blink ? "#2048ff" : "#101830");
      px(c, -2, -32, 8, 5, blink ? "#101830" : "#4080ff");
      px(c, -10, -31, 3, 2, "#e8f0ff");
      px(c, 3, -31, 3, 2, "#e8f0ff");
    }
    px(c, 8, -24, 6, 3, pal.metal);
    px(c, 12, -27, 7, 4, pal.window);
    px(c, -24, -24, 5, 3, pal.metal);
    px(c, -28, -27, 6, 4, pal.window);
    if (p.bumperFront.attached) {
      px(c, 22, -2, 8, 8, pal.metal);
      px(c, 24, -1, 3, 3, blink ? "#ff3030" : "#ffe8a0");
      px(c, 24, 3, 3, 3, blink ? "#ffe8a0" : "#ff3030");
    }
    if (p.bumperRear.attached) {
      px(c, -30, -16, 6, 18, "#c8c8d0");
      px(c, -29, -14, 2, 6, pal.window);
      px(c, -29, -4, 3, 3, blink ? "#ff3030" : "#2048ff");
      px(c, -29, 1, 3, 3, blink ? "#2048ff" : "#ff3030");
    }
    if (p.sideSkirt.attached) {
      px(c, -20, 4, 40, 2, pal.dark);
    }
    if (p.exhaust.attached) {
      px(c, -30, 2, 4, 3, "#2a2c32");
    }
    px(c, 18, -6, 3, 3, car.team === 0 ? "#d8f4ff" : "#ffe8a0");
    px(c, -26, -6, 2, 3, "#ff3030");
    drawDamageCracks(c, dmg, pal);
  }

  function drawVehF1(c, car, pal, p, dmg, spin) {
    if (p.hood.attached) {
      px(c, 10, -3, 22, 6, pal.mid);
      px(c, 12, -4, 18, 2, pal.light);
      px(c, 26, -2, 8, 4, pal.dark);
      px(c, 28, 1, 6, 2, pal.accent);
    }
    px(c, -16, -5, 30, 8, pal.mid);
    px(c, -14, -6, 26, 2, pal.light);
    px(c, -10, -2, 18, 2, pal.stripe);
    if (p.roof.attached) {
      px(c, -4, -10, 10, 6, pal.dark);
      px(c, -2, -12, 6, 4, pal.window);
      px(c, -1, -11, 3, 2, "#8ab0c8");
    }
    if (p.spoiler.attached) {
      px(c, -28, -12, 18, 3, pal.accent);
      px(c, -27, -13, 16, 1, pal.light);
      px(c, -24, -10, 2, 8, pal.dark);
      px(c, -16, -10, 2, 8, pal.dark);
      px(c, -28, 2, 10, 2, pal.dark);
    }
    if (p.exhaust.attached) {
      px(c, -4, -12, 6, 6, pal.dark);
      px(c, -3, -15, 4, 4, "#2a2a30");
      px(c, 4, -11, 5, 5, pal.dark);
      px(c, 5, -14, 3, 3, "#2a2a30");
    }
    if (p.sideSkirt.attached) {
      px(c, -12, 3, 24, 2, pal.dark);
      px(c, -12, 3, 24, 1, pal.light);
    }
    if (p.bumperFront.attached) {
      px(c, 24, 2, 10, 3, pal.accent);
    }
    if (p.bumperRear.attached) {
      px(c, -20, 0, 6, 4, pal.dark);
    }
    px(c, 18, -1, 2, 2, car.team === 0 ? "#d8f4ff" : "#ffe8a0");
    px(c, -14, -1, 2, 2, "#ff3030");
    if (p.wheelRear.attached) drawWheel(c, -20, 5, spin, pal, true, 5, "slick");
    if (p.wheelFront.attached) drawWheel(c, 20, 5, spin * 1.15, pal, true, 4, "slick");
    drawDamageCracks(c, dmg, pal);
  }

  function drawVehOffroad(c, car, pal, p, dmg, spin) {
    if (p.wheelRear.attached) drawWheel(c, -15, 6, spin, pal, true, 8, "knobby");
    if (p.wheelFront.attached) drawWheel(c, 15, 6, spin, pal, true, 8, "knobby");
    px(c, -16, 2, 32, 3, pal.metal);
    px(c, -14, 4, 28, 2, "#4a4e56");
    px(c, -18, -18, 36, 16, pal.mid);
    px(c, -16, -19, 32, 2, pal.light);
    px(c, -18, -4, 36, 2, pal.dark);
    px(c, -8, -12, 18, 3, pal.stripe);
    if (p.hood.attached) {
      px(c, 4, -18, 16, 10, pal.mid);
      px(c, 6, -19, 12, 2, pal.light);
    }
    if (p.roof.attached) {
      px(c, -12, -26, 20, 9, pal.dark);
      px(c, -10, -27, 16, 2, pal.light);
      px(c, -9, -25, 14, 6, pal.window);
      px(c, -8, -24, 5, 3, "#8ab0c8");
    }
    if (p.sideSkirt.attached) {
      px(c, -22, -10, 14, 6, pal.dark);
      px(c, 8, -10, 14, 6, pal.dark);
      px(c, -22, -11, 14, 2, pal.light);
      px(c, 8, -11, 14, 2, pal.light);
      px(c, -21, -4, 12, 2, pal.dark);
      px(c, 9, -4, 12, 2, pal.dark);
    }
    if (p.bumperFront.attached) {
      px(c, 16, -14, 12, 12, pal.metal);
      px(c, 18, -12, 8, 2, "#c8c8d0");
      px(c, 18, -8, 8, 2, "#c8c8d0");
      px(c, 18, -4, 8, 2, "#c8c8d0");
      px(c, 26, -14, 2, 12, "#8a8a94");
    }
    if (p.spoiler.attached) {
      fillDisk(c, -24, -8, 6, "#14161c");
      fillDisk(c, -24, -8, 3, pal.accent);
      px(c, -26, -14, 2, 6, pal.metal);
    }
    if (p.bumperRear.attached) {
      px(c, -26, -14, 8, 10, pal.dark);
    }
    if (p.exhaust.attached) {
      px(c, -24, 0, 4, 3, "#2a2c32");
    }
    px(c, 12, -10, 3, 3, car.team === 0 ? "#d8f4ff" : "#ffe8a0");
    px(c, -18, -10, 2, 3, "#ff3030");
    drawDamageCracks(c, dmg, pal);
  }

  var VEHICLE_DRAW = {
    tractor: drawVehTractor,
    monster: drawVehMonster,
    ambulance: drawVehAmbulance,
    f1: drawVehF1,
    offroad: drawVehOffroad
  };

  function drawCarBody(c, car, ox, oy, angle, parts, spin, opt) {
    c.save();
    c.translate(Math.round(ox), Math.round(oy));
    c.rotate(angle);
    var sc = opt && opt.scale != null ? opt.scale : car.scale || 1;
    var gun = opt && opt.hasGun != null ? !!opt.hasGun : !!car.hasGun;
    var rev = opt && opt.reversed != null ? !!opt.reversed : !!car.reversed;
    var vehId = (opt && opt.vehId) || car.vehId || "offroad";
    var spec = VEHICLES[vehId] || car.spec;
    if (sc !== 1) c.scale(sc, sc);
    var pal = car.palette;
    var p = parts;
    var dmg = 1 - Math.max(0, p.chassis.hp) / p.chassis.max;
    var flash = (opt && opt.flash != null ? opt.flash : car.flash) > 0;
    var drawer = VEHICLE_DRAW[vehId] || drawVehOffroad;
    drawer(c, car, pal, p, dmg, spin);
    if (flash) {
      c.globalAlpha = 0.45;
      px(c, -32, -36, 66, 50, "#ffffff");
      c.globalAlpha = 1;
    }
    drawCarGadgets(c, spec, gun, rev);
    c.restore();
  }

  function drawGoalNet(c, gx, openRight, scale) {
    scale = scale || 1;
    var gh = Math.round(GOAL_H * scale);
    var gy = FLOOR_Y - gh;
    var i, j, nx, ny;
    var net = scale > 1.05 ? "#243848" : "#1a2830";
    c.fillStyle = net;
    for (i = 0; i < GOAL_DEPTH; i += 4) {
      for (j = 0; j < gh; j += 4) {
        nx = gx + (openRight ? i : GOAL_DEPTH - 4 - i);
        ny = gy + j;
        c.fillRect(nx, ny, 1, 4);
        c.fillRect(nx, ny, 4, 1);
      }
    }
    c.fillStyle = scale > 1.05 ? "#fff4c0" : "#e8e8ee";
    c.fillRect(gx, gy, GOAL_DEPTH, GOAL_BAR_H);
    c.fillStyle = "#ffffff";
    c.fillRect(gx + 1, gy + 1, GOAL_DEPTH - 2, 2);
    if (scale > 1.05) {
      c.fillStyle = "rgba(255,220,80,0.18)";
      c.fillRect(gx, gy, GOAL_DEPTH, 3);
    }
  }

  function drawPickup(c, pu) {
    var x = Math.round(pu.x);
    var y = Math.round(pu.y + Math.sin(pu.bob) * 3.5);
    var green = pu.color === "green";
    var fill = green ? "#28c050" : "#e03838";
    var hi = green ? "#c8ffd4" : "#ffd0d0";
    var lo = green ? "#146828" : "#801818";
    var ink = "#f4f4f8";
    c.globalAlpha = 0.22 + 0.16 * Math.sin(pu.bob * 2);
    c.fillStyle = fill;
    c.fillRect(x - 11, y - 11, 22, 22);
    c.globalAlpha = 1;
    px(c, x - 9, y - 9, 18, 18, "#101014");
    px(c, x - 8, y - 8, 16, 16, fill);
    px(c, x - 7, y - 7, 14, 3, hi);
    px(c, x - 7, y + 5, 14, 2, lo);
    if (pu.kind === "shrink") {
      px(c, x - 3, y - 2, 6, 5, ink);
    } else if (pu.kind === "grow") {
      px(c, x - 6, y - 4, 12, 9, ink);
      px(c, x - 1, y - 6, 2, 13, ink);
      px(c, x - 6, y - 1, 12, 2, ink);
    } else if (pu.kind === "reverse") {
      px(c, x - 5, y - 3, 3, 7, ink);
      px(c, x + 2, y - 3, 3, 7, ink);
      px(c, x - 5, y - 4, 10, 2, ink);
    } else if (pu.kind === "gun") {
      px(c, x - 6, y - 1, 13, 3, ink);
      px(c, x - 4, y - 4, 3, 4, ink);
      px(c, x + 6, y - 2, 2, 2, "#2a2a30");
    } else {
      px(c, x - 6, y - 4, 2, 9, ink);
      px(c, x + 4, y - 4, 2, 9, ink);
      px(c, x - 6, y - 5, 12, 2, ink);
    }
    var label = pu.kind === "reverse" ? "TURN" : pu.kind.toUpperCase();
    drawTextCenter(c, label, x, y + 12, hi, 1);
  }

  function drawBullets(c, list) {
    var i, b;
    for (i = 0; i < list.length; i++) {
      b = list[i];
      px(c, Math.round(b.x) - 2, Math.round(b.y) - 1, 5, 2, "#fff4a0");
      px(c, Math.round(b.x), Math.round(b.y) - 1, 2, 2, "#ffffff");
    }
  }

  function drawDebris(c, d) {
    var b = d.body;
    var pal = d.palette;
    c.save();
    c.translate(Math.round(b.x), Math.round(b.y));
    c.rotate(b.angle);
    var n = d.name;
    if (n === "wheelFront" || n === "wheelRear") {
      drawWheel(c, 0, 0, b.angle * 3, pal, true, d.r || WHEEL_R, d.style || "street");
    } else if (n === "spoiler") {
      px(c, -6, -2, 13, 3, pal.dark);
      px(c, -6, -3, 13, 1, pal.light);
    } else if (n === "bumperFront" || n === "bumperRear") {
      px(c, -5, -5, 10, 10, pal.accent);
    } else if (n === "hood") {
      px(c, -8, -3, 16, 6, pal.mid);
      px(c, -6, -4, 12, 2, pal.light);
    } else if (n === "roof") {
      px(c, -9, -3, 18, 6, pal.mid);
      px(c, -7, -2, 14, 4, pal.window);
    } else if (n === "exhaust") {
      px(c, -3, -2, 6, 3, "#2a2c32");
    } else {
      px(c, -8, -2, 16, 4, pal.dark);
    }
    c.restore();
  }

  function drawBallAt(c, bx, by, bang) {
    c.save();
    c.translate(Math.round(bx), Math.round(by));
    c.rotate(bang);
    fillDisk(c, 0, 0, 19, "#d8d8de");
    fillDisk(c, 0, 0, 17, "#f4f4f8");
    fillDisk(c, -6, -7, 5, "#ffffff");
    c.fillStyle = "#121214";
    fillDisk(c, 0, -1, 5, "#121214");
    fillDisk(c, -11, 4, 4, "#121214");
    fillDisk(c, 10, 5, 4, "#121214");
    fillDisk(c, 8, -10, 3, "#121214");
    fillDisk(c, -7, -11, 3, "#121214");
    var i, a, px0, py0;
    for (i = 0; i < 5; i++) {
      a = (i / 5) * Math.PI * 2 - 0.3;
      px0 = Math.round(Math.cos(a) * 6);
      py0 = Math.round(Math.sin(a) * 6);
      c.fillRect(px0, py0, 1, 1);
    }
    c.fillStyle = "#2a2a30";
    for (i = -16; i <= 16; i++) {
      if (i * i < 250) {
        c.fillRect(Math.round(Math.sin(i * 0.22) * 2), i, 1, 1);
        c.fillRect(i, Math.round(Math.cos(i * 0.18) * 3), 1, 1);
      }
    }
    c.restore();
  }

  function drawBall(c) {
    var p = replayPose && (state === "replay" || state === "celebrate") ? replayPose.ball : ball;
    drawBallAt(c, p.x, p.y, p.angle);
  }

  /* Basketball net — disabled while the mode is soccer
  function drawNet(c, originX, rimY, dir, ripple) {
    var i, j, x, y, taper;
    c.fillStyle = "#dcd8cc";
    for (i = 0; i <= 5; i++) {
      for (j = 0; j < 34; j++) {
        taper = 1 - (j / 34) * 0.42;
        x = originX + dir * (3 + i * 9.2 * taper);
        y = rimY + 5 + j;
        x += Math.sin(j * 0.38 + ripple + i * 0.8) * (1.1 + ripple * 0.35);
        c.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    c.fillStyle = "#b8b4a8";
    for (j = 6; j < 32; j += 5) {
      for (i = 0; i < 40; i++) {
        taper = 1 - (j / 34) * 0.42;
        x = originX + dir * (3 + (i / 40) * 46 * taper);
        y = rimY + 5 + j + Math.sin(i * 0.4 + ripple) * 1.2;
        c.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }
  */

  function drawShadow(c, x, y, w) {
    var gy = 423;
    var dist = gy - y;
    if (dist < 0) dist = 0;
    var s = clamp(1 - dist / 280, 0.15, 1);
    c.fillStyle = "rgba(0,0,0," + (0.28 * s).toFixed(3) + ")";
    var rw = Math.round(w * s);
    var i, t;
    for (i = -rw; i <= rw; i++) {
      t = 1 - Math.abs(i) / (rw + 0.01);
      if (t > 0.35) c.fillRect(Math.round(x) + i, gy, 1, 2);
    }
  }

  function drawHud(c) {
    px(c, 0, 16, W, 18, "rgba(8,8,14,0.55)");
    var n0 = "P1 " + (cars[0].spec ? cars[0].spec.name : PAL_P1.name);
    var n1 = (cars[1].spec ? cars[1].spec.name : PAL_P2.name) + " P2";
    drawText(c, n0, 22, 20, "#7ad4f0", 1);
    drawText(c, n1, W - 22 - textWidth(n1, 1), 20, "#f08070", 1);

    drawTextCenter(c, String(score[0]), 360, 20, "#7ad4f0", 2);
    drawTextCenter(c, "-", 400, 20, "#c8c4b0", 2);
    drawTextCenter(c, String(score[1]), 440, 20, "#f08070", 2);

    drawPartPips(c, cars[0], 22, 30);
    drawPartPips(c, cars[1], W - 22 - 70, 30);
    drawCarEffects(c, cars[0], 22, 36, "left");
    drawCarEffects(c, cars[1], W - 22, 36, "right");

    if (state === "play" || state === "countdown") {
      drawTextCenter(c, "W/S DRIVE   A/D ROTATE   P1 SPACE JUMP   P2 SHIFT/ENTER JUMP", 400, 438, "#6a6870", 1);
    }
  }

  function drawCarEffects(c, car, x, y, align) {
    var items = [];
    if (car.scaleT > 0 && car.scale < 0.95) items.push({ s: "SMALL", col: "#ff9090" });
    if (car.scaleT > 0 && car.scale > 1.05) items.push({ s: "BIG", col: "#80f090" });
    if (car.reversed) items.push({ s: "REVERSE", col: "#ffd050" });
    if (car.hasGun) items.push({ s: "GUN", col: "#d8d8e0" });
    var gScale = car.team === 0 ? leftGoalScale : rightGoalScale;
    if (gScale > 1.05) items.push({ s: "WIDE NET", col: "#ffb070" });
    var i, w, xx = x;
    for (i = 0; i < items.length; i++) {
      w = textWidth(items[i].s, 1);
      if (align === "right") {
        drawText(c, items[i].s, xx - w, y, items[i].col, 1);
        xx -= w + 8;
      } else {
        drawText(c, items[i].s, xx, y, items[i].col, 1);
        xx += w + 8;
      }
    }
  }

  function drawPartPips(c, car, x, y) {
    var p = car.parts;
    var names = ["chassis", "wheelFront", "wheelRear", "bumperFront", "spoiler"];
    var i, part, col, w;
    for (i = 0; i < names.length; i++) {
      part = p[names[i]];
      if (!part.attached && names[i] !== "chassis") col = "#2a2a30";
      else {
        var t = Math.max(0, part.hp) / part.max;
        col = t > 0.55 ? "#40c060" : t > 0.25 ? "#e0b020" : "#d03030";
      }
      w = names[i] === "chassis" ? 22 : 10;
      px(c, x, y, w, 3, col);
      x += w + 2;
    }
  }

  function inRect(x, y, b) {
    return x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h;
  }

  function menuButtons() {
    if (state === "title") {
      return [
        { id: "play", x: 260, y: 176, w: 280, h: 38, label: "PLAY GAME" },
        { id: "controls", x: 260, y: 224, w: 280, h: 38, label: "CONTROLS" },
        { id: "mute", x: 260, y: 272, w: 280, h: 38, label: audio.muted ? "UNMUTE AUDIO" : "MUTE AUDIO" }
      ];
    }
    if (state === "controls") {
      return [{ id: "back", x: 300, y: 368, w: 200, h: 36, label: "BACK" }];
    }
    if (state === "select") {
      return [
        { id: "p1prev", x: 62, y: 248, w: 36, h: 28, label: "<" },
        { id: "p1next", x: 322, y: 248, w: 36, h: 28, label: ">" },
        { id: "p1ready", x: 110, y: 288, w: 200, h: 32, label: menu.p1.ready ? "LOCKED" : "READY" },
        { id: "p2prev", x: 442, y: 248, w: 36, h: 28, label: "<" },
        { id: "p2next", x: 702, y: 248, w: 36, h: 28, label: ">" },
        { id: "p2ready", x: 490, y: 288, w: 200, h: 32, label: menu.p2.ready ? "LOCKED" : "READY" },
        { id: "back", x: 300, y: 392, w: 200, h: 32, label: "BACK" }
      ];
    }
    if (state === "pause") {
      return [
        { id: "resume", x: 260, y: 168, w: 280, h: 38, label: "RESUME" },
        { id: "restart", x: 260, y: 216, w: 280, h: 38, label: "RESTART MATCH" },
        { id: "quit", x: 260, y: 264, w: 280, h: 38, label: "QUIT TO MAIN MENU" }
      ];
    }
    if (state === "win") {
      return [
        { id: "again", x: 260, y: 268, w: 280, h: 36, label: "PLAY AGAIN" },
        { id: "quit", x: 260, y: 314, w: 280, h: 36, label: "MAIN MENU" }
      ];
    }
    return [];
  }

  function drawPixelButton(c, btn, selected) {
    var x = btn.x;
    var y = btn.y;
    var w = btn.w;
    var h = btn.h;
    var locked = btn.label === "LOCKED";
    px(c, x, y, w, h, "#08080e");
    px(c, x + 1, y + 1, w - 2, h - 2, selected ? "#3a5088" : locked ? "#1a4028" : "#262834");
    px(c, x + 1, y + 1, w - 2, 2, selected ? "#98c0f0" : locked ? "#40c060" : "#4a4e5c");
    px(c, x + 1, y + h - 3, w - 2, 2, selected ? "#182848" : "#14161c");
    px(c, x + 1, y + 1, 2, h - 2, selected ? "#6a88c0" : "#343844");
    if (selected) {
      px(c, x, y, w, 1, "#f0d060");
      px(c, x, y + h - 1, w, 1, "#f0d060");
      px(c, x, y, 1, h, "#f0d060");
      px(c, x + w - 1, y, 1, h, "#f0d060");
    }
    var col = locked ? "#80f090" : selected ? "#fff4c0" : "#d0d4dc";
    drawTextCenter(c, btn.label, x + w / 2, y + Math.round((h - 7) / 2), col, 1);
  }

  function drawVehiclePreview(c, vehId, team, x, y, spin) {
    var spec = VEHICLES[vehId];
    if (!spec) return;
    var dummy = {
      team: team,
      palette: team === 0 ? PAL_P1 : PAL_P2,
      vehId: vehId,
      spec: spec,
      scale: 1,
      hasGun: false,
      reversed: false,
      flash: 0
    };
    px(c, x - 36, y + 18, 72, 4, "#1a1c24");
    px(c, x - 28, y + 16, 56, 2, "#2a2c34");
    drawCarBody(c, dummy, x, y, 0, makeParts(spec), spin, { scale: 1.35 });
  }

  function cycleVeh(who, dir) {
    if (menu[who].ready) return;
    var n = VEHICLE_IDS.length;
    menu[who].veh = (menu[who].veh + dir + n) % n;
    audio.blip("move");
  }

  function toggleReady(who) {
    if (menu.p1.ready && menu.p2.ready) return;
    menu[who].ready = !menu[who].ready;
    audio.blip(menu[who].ready ? "ready" : "back");
    if (!menu.p1.ready || !menu.p2.ready) menu.bothReadyT = 0;
  }

  function applySelectedVehicles() {
    cars[0].setVehicle(VEHICLE_IDS[menu.p1.veh]);
    cars[1].setVehicle(VEHICLE_IDS[menu.p2.veh]);
  }

  function clearMatchFx() {
    while (debris.length) {
      var d = debris.pop();
      if (d.body && d.body.pl) physWorld.destroyBody(d.body.pl);
    }
    particles.length = 0;
    skids.length = 0;
    historyBuf.length = 0;
    replayFrames.length = 0;
    replayPose = null;
    pendingWin = false;
    goalFlash = 0;
    shake = 0;
    clearPowerups();
  }

  function startMatch() {
    applySelectedVehicles();
    cars[0].resetPose("full");
    cars[1].resetPose("full");
    resetBall();
    score = [0, 0];
    lastScorer = -1;
    clearMatchFx();
    state = "countdown";
    stateT = 0;
    locked = true;
    menu.p1.ready = false;
    menu.p2.ready = false;
    menu.bothReadyT = 0;
  }

  function restartMatch() {
    applySelectedVehicles();
    cars[0].resetPose("full");
    cars[1].resetPose("full");
    resetBall();
    score = [0, 0];
    lastScorer = -1;
    ballInLeft = false;
    ballInRight = false;
    clearMatchFx();
    state = "countdown";
    stateT = 0;
    locked = true;
  }

  function goToMenu() {
    state = "title";
    stateT = 0;
    menu.cursor = 0;
    menu.hover = -1;
    menu.p1.ready = false;
    menu.p2.ready = false;
    menu.bothReadyT = 0;
    locked = true;
    replayPose = null;
    applySelectedVehicles();
    cars[0].resetPose("full");
    cars[1].resetPose("full");
    resetBall();
    clearMatchFx();
    audio.hushEngines();
  }

  function openSelect() {
    state = "select";
    stateT = 0;
    menu.cursor = 2;
    menu.hover = -1;
    menu.p1.ready = false;
    menu.p2.ready = false;
    menu.bothReadyT = 0;
    locked = true;
  }

  function pauseGame() {
    if (state !== "play" && state !== "countdown") return;
    menu.pausedFrom = state;
    menu.cursor = 0;
    menu.hover = -1;
    state = "pause";
    locked = true;
    shake = 0;
    audio.hushEngines();
    audio.blip("ok");
  }

  function resumeGame() {
    state = menu.pausedFrom || "play";
    locked = state !== "play";
    audio.blip("ok");
  }

  function activateMenu(id) {
    if (id === "play" || id === "again") {
      audio.blip("ok");
      openSelect();
    } else if (id === "controls") {
      audio.blip("ok");
      state = "controls";
      menu.cursor = 0;
    } else if (id === "mute") {
      if (!audio.muted) audio.blip("ok");
      audio.muted = !audio.muted;
      if (audio.muted) audio.hushEngines();
      else audio.blip("ok");
    } else if (id === "back") {
      audio.blip("back");
      goToMenu();
    } else if (id === "resume") {
      resumeGame();
    } else if (id === "restart") {
      audio.blip("ok");
      restartMatch();
    } else if (id === "quit") {
      audio.blip("back");
      goToMenu();
    } else if (id === "p1prev") cycleVeh("p1", -1);
    else if (id === "p1next") cycleVeh("p1", 1);
    else if (id === "p1ready") toggleReady("p1");
    else if (id === "p2prev") cycleVeh("p2", -1);
    else if (id === "p2next") cycleVeh("p2", 1);
    else if (id === "p2ready") toggleReady("p2");
  }

  function updateMenu() {
    var buttons = menuButtons();
    var i;
    var hi = -1;
    for (i = 0; i < buttons.length; i++) {
      if (inRect(mouse.x, mouse.y, buttons[i])) {
        hi = i;
        break;
      }
    }
    if (hi >= 0 && hi !== menu.hover) {
      menu.hover = hi;
      menu.cursor = hi;
      audio.blip("move");
    } else if (hi < 0) {
      menu.hover = -1;
    }
    if (menu.cursor >= buttons.length) menu.cursor = 0;

    if (state === "title" || state === "controls" || state === "pause" || state === "win") {
      if (pressed("ArrowUp") || pressed("KeyW")) {
        menu.cursor = (menu.cursor + buttons.length - 1) % Math.max(1, buttons.length);
        audio.blip("move");
      }
      if (pressed("ArrowDown") || pressed("KeyS")) {
        menu.cursor = (menu.cursor + 1) % Math.max(1, buttons.length);
        audio.blip("move");
      }
      if (pressed("Enter") || pressed("Space") || pressed("NumpadEnter")) {
        if (buttons[menu.cursor]) activateMenu(buttons[menu.cursor].id);
      }
    }

    if (state === "select") {
      if (pressed("KeyA")) cycleVeh("p1", -1);
      if (pressed("KeyD")) cycleVeh("p1", 1);
      if (pressed("Space") || pressed("KeyW")) toggleReady("p1");
      if (pressed("ArrowLeft")) cycleVeh("p2", -1);
      if (pressed("ArrowRight")) cycleVeh("p2", 1);
      if (pressed("Enter") || pressed("NumpadEnter")) {
        if (buttons[menu.cursor] && buttons[menu.cursor].id === "back") activateMenu("back");
        else toggleReady("p2");
      }
      if (pressed("ArrowUp")) toggleReady("p2");
      if (pressed("KeyS") || pressed("ArrowDown")) {
        menu.cursor = buttons.length - 1;
        audio.blip("move");
      }
    }

    if (pressed("Escape")) {
      if (state === "select" || state === "controls") {
        audio.blip("back");
        goToMenu();
      } else if (state === "pause") {
        resumeGame();
      }
    }

    if (mouse.clicked) {
      if (hi >= 0) activateMenu(buttons[hi].id);
      mouse.clicked = false;
    }

    if (state === "select") {
      if (menu.p1.ready && menu.p2.ready) {
        menu.bothReadyT += STEP;
        if (menu.bothReadyT >= 0.55) startMatch();
      } else {
        menu.bothReadyT = 0;
      }
    }
  }

  function drawMainMenu(c) {
    c.fillStyle = "rgba(6,8,14,0.72)";
    c.fillRect(0, 0, W, H);
    drawTextCenter(c, "RIMWRECK", 400, 48, "#f0d060", 5);
    drawTextCenter(c, "RIMWRECK", 399, 47, "#fff4c0", 5);
    drawTextCenter(c, "1v1 DEMOLITION SOCCER", 400, 96, "#c8c4b0", 1);
    px(c, 250, 116, 300, 2, "#3a3844");
    px(c, 280, 118, 240, 1, "#f0d060");
    var buttons = menuButtons();
    var i;
    for (i = 0; i < buttons.length; i++) drawPixelButton(c, buttons[i], i === menu.cursor);
    drawTextCenter(c, "FIRST TO " + WIN_SCORE, 400, 328, "#f0d060", 1);
    px(c, 0, 424, W, 26, "rgba(6,8,14,0.75)");
    drawTextCenter(c, "W/S OR ARROWS MOVE    ENTER SELECT    ESC BACK", 400, 430, "#8a8890", 1);
  }

  function drawControlsMenu(c) {
    c.fillStyle = "rgba(6,8,14,0.82)";
    c.fillRect(0, 0, W, H);
    drawTextCenter(c, "CONTROLS", 400, 36, "#fff4c0", 3);
    px(c, 250, 66, 300, 1, "#3a3844");

    drawText(c, "PLAYER 1", 110, 90, "#7ad4f0", 1);
    drawText(c, "W FORWARD", 110, 112, "#d0d4dc", 1);
    drawText(c, "S BACK", 110, 128, "#d0d4dc", 1);
    drawText(c, "A/D ROTATE", 110, 144, "#d0d4dc", 1);
    drawText(c, "SPACE JUMP", 110, 160, "#d0d4dc", 1);

    drawText(c, "PLAYER 2", 470, 90, "#f08070", 1);
    drawText(c, "UP FORWARD", 470, 112, "#d0d4dc", 1);
    drawText(c, "DOWN BACK", 470, 128, "#d0d4dc", 1);
    drawText(c, "LEFT/RIGHT ROTATE", 470, 144, "#d0d4dc", 1);
    drawText(c, "SHIFT OR ENTER JUMP", 470, 160, "#d0d4dc", 1);

    drawTextCenter(c, "MENUS", 400, 200, "#f0d060", 1);
    drawTextCenter(c, "ARROWS OR W/S MOVE CURSOR", 400, 220, "#a8a8b0", 1);
    drawTextCenter(c, "ENTER OR CLICK TO SELECT", 400, 236, "#a8a8b0", 1);
    drawTextCenter(c, "ESC PAUSE DURING A MATCH", 400, 252, "#a8a8b0", 1);
    drawTextCenter(c, "HARD HITS RIP PARTS OFF. FIRST TO " + WIN_SCORE + " WINS.", 400, 284, "#8a8890", 1);
    drawTextCenter(c, "GREEN POWERUPS HELP YOU. RED POWERUPS ARE TRAPS.", 400, 300, "#8a8890", 1);

    var buttons = menuButtons();
    var i;
    for (i = 0; i < buttons.length; i++) drawPixelButton(c, buttons[i], i === menu.cursor);
  }

  function drawSelectMenu(c) {
    c.fillStyle = "rgba(6,8,14,0.84)";
    c.fillRect(0, 0, W, H);
    drawTextCenter(c, "SELECT YOUR RIDE", 400, 22, "#fff4c0", 2);
    px(c, 40, 56, 340, 320, "#101218");
    px(c, 42, 58, 336, 316, "#181c28");
    px(c, 420, 56, 340, 320, "#101218");
    px(c, 422, 58, 336, 316, "#181c28");
    px(c, 40, 56, 340, 2, "#7ad4f0");
    px(c, 420, 56, 340, 2, "#f08070");

    drawTextCenter(c, "PLAYER 1", 210, 68, "#7ad4f0", 1);
    drawTextCenter(c, "PLAYER 2", 590, 68, "#f08070", 1);

    var id0 = VEHICLE_IDS[menu.p1.veh];
    var id1 = VEHICLE_IDS[menu.p2.veh];
    var spin = menuClock * 5;
    drawVehiclePreview(c, id0, 0, 210, 168, spin);
    drawVehiclePreview(c, id1, 1, 590, 168, spin);

    drawTextCenter(c, VEHICLES[id0].name, 210, 228, menu.p1.ready ? "#80f090" : "#e8e8ee", 1);
    drawTextCenter(c, VEHICLES[id1].name, 590, 228, menu.p2.ready ? "#80f090" : "#e8e8ee", 1);

    if (menu.p1.ready) drawTextCenter(c, "READY", 210, 332, "#80f090", 1);
    else drawTextCenter(c, "NOT READY", 210, 332, "#8a8890", 1);
    if (menu.p2.ready) drawTextCenter(c, "READY", 590, 332, "#80f090", 1);
    else drawTextCenter(c, "NOT READY", 590, 332, "#8a8890", 1);

    var buttons = menuButtons();
    var i;
    for (i = 0; i < buttons.length; i++) drawPixelButton(c, buttons[i], i === menu.cursor);

    if (menu.p1.ready && menu.p2.ready) {
      drawTextCenter(c, "BOTH READY", 400, 434, "#fff4c0", 1);
    } else {
      drawTextCenter(c, "P1 A/D CYCLE  SPACE READY     P2 ARROWS CYCLE  ENTER READY", 400, 434, "#5a5860", 1);
    }
  }

  function drawPauseMenu(c) {
    c.fillStyle = "rgba(4,6,12,0.72)";
    c.fillRect(0, 0, W, H);
    drawTextCenter(c, "PAUSED", 400, 88, "#fff4c0", 4);
    px(c, 280, 128, 240, 2, "#3a3844");
    var buttons = menuButtons();
    var i;
    for (i = 0; i < buttons.length; i++) drawPixelButton(c, buttons[i], i === menu.cursor);
    drawTextCenter(c, "ESC RESUME", 400, 330, "#5a5860", 1);
  }

  function drawOverlay(c) {
    if (state === "title") {
      drawMainMenu(c);
    }

    if (state === "controls") {
      drawControlsMenu(c);
    }

    if (state === "select") {
      drawSelectMenu(c);
    }

    if (state === "countdown") {
      var n = 3 - Math.floor(stateT);
      var label = n <= 0 ? "GO" : String(n);
      drawTextCenter(c, label, 400, 150, "#fff4c0", 8);
      if (cars[0].spec && cars[1].spec) {
        drawTextCenter(c, cars[0].spec.name + "  VS  " + cars[1].spec.name, 400, 230, "#c8c4b0", 1);
      }
    }

    if (state === "celebrate") {
      var pulse = 0.35 + 0.35 * Math.abs(Math.sin(stateT * 22));
      c.fillStyle = "rgba(255,255,255," + pulse.toFixed(3) + ")";
      c.fillRect(0, 0, W, H);
      drawTextCenter(c, "GOAL", 400, 138, lastScorer === 0 ? "#7ad4f0" : "#f08070", 6);
      drawTextCenter(c, (lastScorer === 0 ? "CYAN" : "CRIMSON") + " SCORES", 400, 190, "#fff0d0", 1);
    }

    if (state === "replay") {
      drawCamcorder(c);
      drawTextCenter(c, "INSTANT REPLAY", 400, 22, "#ffffff", 1);
      drawTextCenter(c, "P SKIP", 400, 438, "#8a8a94", 1);
    }

    if (state === "goal") {
      c.fillStyle = "rgba(8,6,4,0.25)";
      c.fillRect(0, 120, W, 80);
      drawTextCenter(c, "GOAL", 400, 138, lastScorer === 0 ? "#7ad4f0" : "#f08070", 6);
      drawTextCenter(c, (lastScorer === 0 ? "CYAN" : "CRIMSON") + " SCORES", 400, 190, "#fff0d0", 1);
    }

    if (state === "win") {
      c.fillStyle = "rgba(6,8,14,0.62)";
      c.fillRect(0, 0, W, H);
      var winner = score[0] >= WIN_SCORE ? 0 : 1;
      drawTextCenter(c, (winner === 0 ? "CYAN" : "CRIMSON") + " WINS", 400, 150, winner === 0 ? "#7ad4f0" : "#f08070", 4);
      drawTextCenter(c, score[0] + " - " + score[1], 400, 200, "#fff4c0", 3);
      var wb = menuButtons();
      var wi;
      for (wi = 0; wi < wb.length; wi++) drawPixelButton(c, wb[wi], wi === menu.cursor);
    }

    if (state === "pause") {
      drawPauseMenu(c);
    }
  }

  function drawCamcorder(c) {
    var blink = ((time * 4) | 0) % 2 === 0;
    if (blink) {
      c.fillStyle = "#ff2020";
      c.fillRect(22, 20, 7, 7);
    }
    drawText(c, "REC", 34, 20, "#ff3030", 1);
    c.fillStyle = "#ffffff";
    c.fillRect(10, 10, 22, 3);
    c.fillRect(10, 10, 3, 22);
    c.fillRect(W - 32, 10, 22, 3);
    c.fillRect(W - 13, 10, 3, 22);
    c.fillRect(10, H - 13, 22, 3);
    c.fillRect(10, H - 32, 3, 22);
    c.fillRect(W - 32, H - 13, 22, 3);
    c.fillRect(W - 13, H - 32, 3, 22);
  }

  function drawDebug(c) {
    if (!debug || !physWorld) return;
    var b, f, sh, p, i;
    c.strokeStyle = "rgba(80,255,120,0.7)";
    c.lineWidth = 1;
    for (b = physWorld.getBodyList(); b; b = b.getNext()) {
      p = b.getPosition();
      c.save();
      c.translate(PX(p.x), PX(p.y));
      c.rotate(b.getAngle());
      for (f = b.getFixtureList(); f; f = f.getNext()) {
        sh = f.getShape();
        if (sh.m_type === "circle" || (sh.getType && sh.getType() === "circle")) {
          c.beginPath();
          c.arc(PX(sh.m_p ? sh.m_p.x : 0), PX(sh.m_p ? sh.m_p.y : 0), PX(sh.m_radius), 0, Math.PI * 2);
          c.stroke();
        } else if (sh.m_type === "polygon" || (sh.getType && sh.getType() === "polygon")) {
          var vs = sh.m_vertices || [];
          if (vs.length) {
            c.beginPath();
            c.moveTo(PX(vs[0].x), PX(vs[0].y));
            for (i = 1; i < vs.length; i++) c.lineTo(PX(vs[i].x), PX(vs[i].y));
            c.closePath();
            c.stroke();
          }
        }
      }
      c.restore();
    }
  }

  function render() {
    var sx = 0;
    var sy = 0;
    if (shake > 0) {
      sx = ((Math.random() - 0.5) * 2 * shake) | 0;
      sy = ((Math.random() - 0.5) * 2 * shake) | 0;
    }
    ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
    crisp(ctx);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sx, sy);

    var pose = replayPose && (state === "replay" || state === "celebrate") ? replayPose : null;
    var bx = pose ? pose.ball.x : ball.x;
    var by = pose ? pose.ball.y : ball.y;
    if (state === "replay") {
      var zoom = 1.7;
      var halfW = W / (2 * zoom);
      var halfH = H / (2 * zoom);
      var cx = clamp(bx, halfW, W - halfW);
      var cy = clamp(by, halfH, H - halfH);
      ctx.translate(W * 0.5, H * 0.5);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
    }

    crisp(ctx);
    ctx.drawImage(bgCanvas, 0, 0);
    crisp(ctx);

    var lg = pose && pose.leftGoalScale != null ? pose.leftGoalScale : leftGoalScale;
    var rg = pose && pose.rightGoalScale != null ? pose.rightGoalScale : rightGoalScale;
    drawGoalNet(ctx, 16, true, lg);
    drawGoalNet(ctx, 784 - GOAL_DEPTH, false, rg);

    var i, p;
    for (i = 0; i < skids.length; i++) {
      p = skids[i];
      ctx.globalAlpha = clamp(p.life / 2.2, 0, 0.45);
      ctx.fillStyle = "#1a1a20";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 2);
    }
    ctx.globalAlpha = 1;

    /* Basketball nets — disabled
    drawNet(ctx, 26, RIM_LINE_Y, 1, netRipple);
    drawNet(ctx, 774, RIM_LINE_Y, -1, netRipple);
    */

    var c0 = pose ? pose.cars[0] : cars[0].body;
    var c1 = pose ? pose.cars[1] : cars[1].body;
    var p0 = pose ? pose.cars[0].parts : cars[0].parts;
    var p1 = pose ? pose.cars[1].parts : cars[1].parts;
    var s0 = pose ? pose.cars[0].wheelSpin : cars[0].wheelSpin;
    var s1 = pose ? pose.cars[1].wheelSpin : cars[1].wheelSpin;
    var sc0 = pose ? pose.cars[0].scale : cars[0].scale;
    var sc1 = pose ? pose.cars[1].scale : cars[1].scale;
    var spec0 = VEHICLES[(pose && pose.cars[0].vehId) || cars[0].vehId] || cars[0].spec;
    var spec1 = VEHICLES[(pose && pose.cars[1].vehId) || cars[1].vehId] || cars[1].spec;
    drawShadow(ctx, c0.x, c0.y, (spec0.chassis.hw + spec0.wheelFront.r) * (sc0 || 1));
    drawShadow(ctx, c1.x, c1.y, (spec1.chassis.hw + spec1.wheelFront.r) * (sc1 || 1));
    drawShadow(ctx, bx, by, 20);

    if (pose) {
      for (i = 0; i < pose.debris.length; i++) {
        drawDebris(ctx, { body: pose.debris[i], name: pose.debris[i].name, palette: pose.debris[i].palette });
      }
    } else {
      for (i = 0; i < debris.length; i++) drawDebris(ctx, debris[i]);
    }

    var shownPickups = pose && pose.pickups ? pose.pickups : pickups;
    var shownBullets = pose && pose.bullets ? pose.bullets : bullets;
    for (i = 0; i < shownPickups.length; i++) drawPickup(ctx, shownPickups[i]);

    drawCarBody(ctx, cars[0], c0.x, c0.y, c0.angle, p0, s0, pose ? pose.cars[0] : null);
    drawCarBody(ctx, cars[1], c1.x, c1.y, c1.angle, p1, s1, pose ? pose.cars[1] : null);
    drawBallAt(ctx, bx, by, pose ? pose.ball.angle : ball.angle);
    drawBullets(ctx, shownBullets);

    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
    crisp(ctx);
    if (goalFlash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + Math.min(1, goalFlash).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (state === "play" || state === "countdown" || state === "celebrate" || state === "goal" || state === "pause") {
      drawHud(ctx);
    }
    drawOverlay(ctx);
    if (debug && state !== "replay") {
      ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
      ctx.translate(sx, sy);
      drawDebug(ctx);
    }
  }

  /* ---------- match flow ---------- */
  function newMatch(fromTitle) {
    if (fromTitle) startMatch();
    else goToMenu();
  }

  function endReplay() {
    replayPose = null;
    replayFrames.length = 0;
    if (pendingWin) {
      state = "win";
      stateT = 0;
      locked = true;
      menu.cursor = 0;
      menu.hover = -1;
    } else {
      afterGoalReset();
    }
  }

  function afterGoalReset() {
    cars[0].resetPose("pit");
    cars[1].resetPose("pit");
    resetBall();
    state = "countdown";
    stateT = 0;
    locked = true;
    ballInLeft = false;
    ballInRight = false;
    historyBuf.length = 0;
    replayPose = null;
    prevBallX = ball.x;
    prevBallY = ball.y;
    clearPowerups();
  }

  function initWorld() {
    createPhysWorld();
    debris = [];
    particles = [];
    skids = [];
    score = [0, 0];
    shake = 0;
    netRipple = 0;
    time = 0;
    state = "title";
    stateT = 0;
    locked = true;
    buildArena();
    paintBackground();
    cars = [
      new Car({
        team: 0,
        palette: PAL_P1,
        vehicle: VEHICLE_IDS[menu.p1.veh],
        x: 290,
        controls: { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", jump: "Space" }
      }),
      new Car({
        team: 1,
        palette: PAL_P2,
        vehicle: VEHICLE_IDS[menu.p2.veh],
        x: 510,
        controls: { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", jump: ["ShiftLeft", "ShiftRight", "Enter", "NumpadEnter"] }
      })
    ];
    spawnBall();
    if (/[?&]play=1/.test(location.search)) {
      startMatch();
      stateT = 2.6;
    }
    var qmenu = /[?&]menu=([^&]+)/.exec(location.search);
    if (qmenu) {
      if (qmenu[1] === "select") openSelect();
      else if (qmenu[1] === "controls") {
        state = "controls";
        menu.cursor = 0;
      } else if (qmenu[1] === "pause") {
        startMatch();
        state = "play";
        locked = false;
        pauseGame();
      }
    }
  }

  function isMenuState() {
    return state === "title" || state === "controls" || state === "select" || state === "pause" || state === "win";
  }

  function update(dt) {
    menuClock += dt;
    if (state !== "pause") {
      time += dt;
      stateT += dt;
    }

    if (isMenuState()) {
      if (pressed("KeyM") && state !== "title") audio.muted = !audio.muted;
      updateMenu();
      cars[0].throttle = 0;
      cars[1].throttle = 0;
      zeroMotors(cars[0]);
      zeroMotors(cars[1]);
      audio.hushEngines();
      canvas.style.cursor = menu.hover >= 0 ? "pointer" : "default";
      return;
    }

    if (gaspCD > 0) gaspCD -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * (state === "celebrate" ? 10 : 18));
    if (goalFlash > 0) goalFlash = Math.max(0, goalFlash - dt * (state === "celebrate" ? 2.4 : 4));
    if (netRipple > 0) netRipple = Math.max(0, netRipple - dt * 6);
    if (cars[0].flash > 0) cars[0].flash -= dt;
    if (cars[1].flash > 0) cars[1].flash -= dt;
    if (cars[0].hurtCD > 0) cars[0].hurtCD -= dt;
    if (cars[1].hurtCD > 0) cars[1].hurtCD -= dt;
    if (cars[0].jumpIgnore > 0) cars[0].jumpIgnore -= dt;
    if (cars[1].jumpIgnore > 0) cars[1].jumpIgnore -= dt;

    canvas.style.cursor = "default";
    if (pressed("KeyM")) audio.muted = !audio.muted;
    if (pressed("Escape") && (state === "play" || state === "countdown")) {
      pauseGame();
      return;
    }

    if (state === "countdown") {
      locked = true;
      if (stateT >= 3) {
        state = "play";
        stateT = 0;
        locked = false;
        audio.tone(620, 0.16, "square", 0.06, 1);
        if (/[?&]pu=1/.test(location.search)) {
          spawnPickup();
          spawnPickup();
        }
        if (/[?&]fx=1/.test(location.search)) {
          cars[0].setScale(1.55);
          cars[0].scaleT = 8;
          cars[0].hasGun = true;
          cars[0].gunT = 8;
          cars[1].setScale(0.58);
          cars[1].scaleT = 8;
          cars[1].reversed = true;
          cars[1].reverseT = 8;
          setGoalScale("right", 1.7, 8);
        }
      }
    } else if (state === "play") {
      locked = false;
    } else if (state === "celebrate") {
      locked = true;
      if (stateT >= 0.48) {
        state = "replay";
        stateT = 0;
        replayIndex = 0;
        replayAcc = 0;
        replayPose = replayFrames[0] || snapshotFrame();
      }
    } else if (state === "replay") {
      locked = true;
      if (pressed("KeyP")) {
        endReplay();
      } else {
        replayAcc += dt * REPLAY_SLOW;
        while (replayAcc >= STEP && replayIndex < replayFrames.length - 1) {
          replayAcc -= STEP;
          replayIndex += 1;
        }
        replayPose = replayFrames[Math.min(replayIndex, replayFrames.length - 1)];
        if (replayIndex >= replayFrames.length - 1) endReplay();
      }
    } else if (state === "goal") {
      locked = true;
      if (stateT >= 2.1) afterGoalReset();
    }

    if (!locked && state === "play") {
      CarControl(cars[0], dt);
      CarControl(cars[1], dt);
    } else {
      cars[0].throttle = 0;
      cars[1].throttle = 0;
      zeroMotors(cars[0]);
      zeroMotors(cars[1]);
    }
    var live = state === "play" || state === "countdown";
    if (live) {
      physContacts.length = 0;
      physWorld.step(dt, VEL_ITERS, POS_ITERS);
      cars[0].body.sync();
      cars[1].body.sync();
      ball.sync();
      var di;
      for (di = 0; di < debris.length; di++) debris[di].body.sync();
      updateGrounded();
      if (state === "play") {
        applyDamageFromContacts();
        updatePickups(dt);
        updateEffects(dt);
        updateGuns(dt);
        recordHistory();
        checkScore();
        updateCrowdTension();
      }
    }
    updateParticles(dt);

    if (live && ball.y > H + 60) resetBall();
    var ci;
    if (live) {
      for (ci = 0; ci < 2; ci++) {
        if (cars[ci].body.y > H + 80) cars[ci].resetPose(null);
        cars[ci].wheelSpin += cars[ci].throttle * dt * 10 + cars[ci].body.vx * dt * 0.08;
        if (
          cars[ci].grounded &&
          Math.abs(cars[ci].throttle) > 0.3 &&
          Math.abs(cars[ci].body.vx) > 50 &&
          Math.random() < 0.3
        ) {
          var wp = cars[ci].body.worldPoint(0, cars[ci].spec.wheelRear.y + cars[ci].spec.wheelRear.r);
          skids.push({ x: wp.x, y: wp.y, life: 2.2 });
        }
      }
    }

    if (state === "play") audio.tick(cars);
    else audio.hushEngines();
  }

  function zeroMotors(car) {
    if (car.jf && car.jf.setMotorSpeed) {
      car.jf.setMotorSpeed(0);
      car.jf.setMaxMotorTorque(8);
    }
    if (car.jr && car.jr.setMotorSpeed) {
      car.jr.setMotorSpeed(0);
      car.jr.setMaxMotorTorque(8);
    }
  }

  /* ---------- boot ---------- */
  function fit() {
    var dpr = window.devicePixelRatio || 1;
    var cssScale = Math.min(window.innerWidth / W, window.innerHeight / H);
    var cssW = Math.max(1, Math.round(W * cssScale));
    var cssH = Math.max(1, Math.round(H * cssScale));
    wrap.style.width = cssW + "px";
    wrap.style.height = cssH + "px";
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    drawScale = canvas.width / W;
    ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
    crisp(ctx);
  }
  window.addEventListener("resize", fit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fit);
  }
  function mouseFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * W;
    mouse.y = ((e.clientY - rect.top) / rect.height) * H;
  }
  canvas.addEventListener("pointermove", function (e) {
    mouseFromEvent(e);
  });
  canvas.addEventListener("pointerdown", function (e) {
    audio.boot();
    mouseFromEvent(e);
    mouse.down = true;
    mouse.clicked = true;
  });
  canvas.addEventListener("pointerup", function () {
    mouse.down = false;
  });
  fit();

  initWorld();

  var acc = 0;
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    just = Object.create(null);
    mouse.clicked = false;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
