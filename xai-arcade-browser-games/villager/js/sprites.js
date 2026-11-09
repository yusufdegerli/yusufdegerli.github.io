const Spr = {
  tiles: [],
  ready: false,

  init() {
    this.tiles = [];
    const rnd = U.seeded(0x51a77e);
    for (let i = 0; i < 8; i++) this.tiles.push(this.makeGrass(rnd));
    this.dirt = this.makeDirt(rnd);
    this.water = this.makeWater(rnd);
    this.ready = true;
  },

  canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return { c, g: c.getContext("2d") };
  },

  makeGrass(rnd) {
    const t = CFG.tile;
    const { c, g } = this.canvas(t, t);
    const bases = ["#4a6a32", "#45622e", "#507038", "#3f5c2c"];
    g.fillStyle = bases[(rnd() * bases.length) | 0];
    g.fillRect(0, 0, t, t);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * t;
      const y = rnd() * t;
      g.fillStyle = rnd() > 0.5 ? "#5a7c3c" : "#3a5426";
      g.fillRect(x, y, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = rnd() > 0.5 ? "rgba(90,140,50,0.45)" : "rgba(30,50,16,0.35)";
      g.lineWidth = 1;
      const x = rnd() * t;
      const y = rnd() * t;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 4);
      g.stroke();
    }
    if (rnd() > 0.72) {
      g.fillStyle = rnd() > 0.5 ? "#c9b45a" : "#c46a7a";
      g.beginPath();
      g.arc(rnd() * t, rnd() * t, 1.2, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  },

  makeDirt(rnd) {
    const t = CFG.tile;
    const { c, g } = this.canvas(t, t);
    g.fillStyle = "#6b5334";
    g.fillRect(0, 0, t, t);
    for (let i = 0; i < 50; i++) {
      g.fillStyle = rnd() > 0.5 ? "#7a6240" : "#5a4428";
      g.fillRect(rnd() * t, rnd() * t, 3, 2);
    }
    return c;
  },

  makeWater(rnd) {
    const t = CFG.tile;
    const { c, g } = this.canvas(t, t);
    g.fillStyle = "#2a4e62";
    g.fillRect(0, 0, t, t);
    g.fillStyle = "rgba(70,140,160,0.25)";
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.ellipse(rnd() * t, rnd() * t, 8 + rnd() * 10, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  },

  tree(g, x, y, variant, depleted) {
    g.save();
    g.translate(x, y);
    if (depleted) {
      g.fillStyle = "#4a3420";
      g.beginPath();
      g.ellipse(0, 4, 6, 3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#6a4a2a";
      g.fillRect(-3, -2, 6, 8);
      g.restore();
      return;
    }
    g.fillStyle = "rgba(20,30,10,0.28)";
    g.beginPath();
    g.ellipse(2, 10, 16, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5a3a1c";
    g.fillRect(-3, -2, 6, 14);
    const pal = [
      ["#2f5a22", "#3f7a2c", "#245018"],
      ["#355c24", "#4a8230", "#2a4e1c"],
      ["#3a5220", "#5a7830", "#2e4418"],
    ][variant % 3];
    g.fillStyle = pal[0];
    g.beginPath();
    g.ellipse(0, -10, 18, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pal[1];
    g.beginPath();
    g.ellipse(-5, -14, 10, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pal[2];
    g.beginPath();
    g.ellipse(6, -8, 8, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  },

  bush(g, x, y, depleted) {
    g.save();
    g.translate(x, y);
    g.fillStyle = "rgba(20,30,10,0.22)";
    g.beginPath();
    g.ellipse(1, 6, 12, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = depleted ? "#3a4a28" : "#3d6a28";
    g.beginPath();
    g.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = depleted ? "#4a5a30" : "#508638";
    g.beginPath();
    g.ellipse(-4, -3, 7, 5, 0, 0, Math.PI * 2);
    g.fill();
    if (!depleted) {
      g.fillStyle = "#c43a48";
      for (const p of [
        [-5, -1],
        [3, 1],
        [6, -3],
        [-1, 3],
        [1, -4],
      ]) {
        g.beginPath();
        g.arc(p[0], p[1], 1.7, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  },

  gold(g, x, y, depleted) {
    g.save();
    g.translate(x, y);
    g.fillStyle = "rgba(20,16,8,0.25)";
    g.beginPath();
    g.ellipse(1, 8, 14, 6, 0, 0, Math.PI * 2);
    g.fill();
    const cols = depleted ? ["#8a7a40", "#6a5a28"] : ["#e6c44a", "#c9a028", "#f0de7a"];
    const pts = [
      [-12, 2, 14, 11],
      [0, -2, 16, 13],
      [-4, -8, 11, 10],
    ];
    pts.forEach((p, i) => {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.moveTo(p[0], p[1] + p[3] * 0.4);
      g.lineTo(p[0] + p[2] * 0.5, p[1]);
      g.lineTo(p[0] + p[2], p[1] + p[3] * 0.5);
      g.lineTo(p[0] + p[2] * 0.4, p[1] + p[3]);
      g.closePath();
      g.fill();
    });
    if (!depleted) {
      g.fillStyle = "rgba(255,240,160,0.7)";
      g.fillRect(2, -2, 2, 2);
    }
    g.restore();
  },

  stone(g, x, y, depleted) {
    g.save();
    g.translate(x, y);
    g.fillStyle = "rgba(16,16,18,0.25)";
    g.beginPath();
    g.ellipse(1, 8, 14, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = depleted ? "#6a6e74" : "#8a9098";
    g.beginPath();
    g.moveTo(-12, 4);
    g.lineTo(-6, -6);
    g.lineTo(4, -8);
    g.lineTo(13, 0);
    g.lineTo(8, 10);
    g.lineTo(-8, 10);
    g.closePath();
    g.fill();
    g.fillStyle = depleted ? "#5a5e64" : "#b0b6be";
    g.beginPath();
    g.moveTo(-4, -2);
    g.lineTo(2, -7);
    g.lineTo(8, -1);
    g.lineTo(2, 3);
    g.closePath();
    g.fill();
    g.restore();
  },

  hall(g, x, y, s, age, color, constructing) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "rgba(20,16,10,0.32)";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.82, w * 0.46, h * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    if (age < 2) {
      g.fillStyle = "#7a5530";
      g.fillRect(w * 0.08, h * 0.42, w * 0.84, h * 0.4);
      g.fillStyle = "#5a3a18";
      g.fillRect(w * 0.28, h * 0.32, w * 0.44, h * 0.5);
      g.fillStyle = "#6a4220";
      g.beginPath();
      g.moveTo(w * 0.02, h * 0.46);
      g.lineTo(w * 0.22, h * 0.22);
      g.lineTo(w * 0.42, h * 0.46);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(w * 0.58, h * 0.46);
      g.lineTo(w * 0.78, h * 0.22);
      g.lineTo(w * 0.98, h * 0.46);
      g.closePath();
      g.fill();
      g.fillStyle = "#4a2c10";
      g.beginPath();
      g.moveTo(w * 0.24, h * 0.36);
      g.lineTo(w * 0.5, h * 0.08);
      g.lineTo(w * 0.76, h * 0.36);
      g.closePath();
      g.fill();
      g.fillStyle = "#c9a05a";
      g.fillRect(w * 0.44, h * 0.54, w * 0.12, h * 0.28);
      g.fillStyle = color;
      g.fillRect(w * 0.14, h * 0.54, w * 0.1, h * 0.1);
      g.fillRect(w * 0.76, h * 0.54, w * 0.1, h * 0.1);
      g.fillRect(w * 0.34, h * 0.46, w * 0.08, h * 0.08);
      g.fillRect(w * 0.58, h * 0.46, w * 0.08, h * 0.08);
      g.fillStyle = color;
      g.fillRect(w * 0.47, h * 0.1, 4, 22);
      g.fillRect(w * 0.42, h * 0.1, 14, 8);
    } else {
      g.fillStyle = "#8a8680";
      g.fillRect(w * 0.06, h * 0.4, w * 0.88, h * 0.42);
      g.fillStyle = "#6e6a64";
      g.fillRect(w * 0.26, h * 0.28, w * 0.48, h * 0.54);
      g.fillStyle = "#6a2a22";
      g.beginPath();
      g.moveTo(w * 0.2, h * 0.32);
      g.lineTo(w * 0.5, h * 0.04);
      g.lineTo(w * 0.8, h * 0.32);
      g.closePath();
      g.fill();
      g.fillStyle = "#4a1c16";
      g.beginPath();
      g.moveTo(w * 0.02, h * 0.44);
      g.lineTo(w * 0.2, h * 0.24);
      g.lineTo(w * 0.38, h * 0.44);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(w * 0.62, h * 0.44);
      g.lineTo(w * 0.8, h * 0.24);
      g.lineTo(w * 0.98, h * 0.44);
      g.closePath();
      g.fill();
      g.fillStyle = "#d4c49a";
      g.fillRect(w * 0.44, h * 0.52, w * 0.14, h * 0.3);
      g.fillStyle = color;
      g.fillRect(w * 0.12, h * 0.52, w * 0.12, h * 0.12);
      g.fillRect(w * 0.76, h * 0.52, w * 0.12, h * 0.12);
      g.fillStyle = "#c9b48a";
      g.fillRect(w * 0.46, h * 0.1, w * 0.08, h * 0.16);
    }
    g.restore();
  },

  house(g, x, y, s, age, color, constructing) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "rgba(20,16,10,0.25)";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.72, w * 0.38, h * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    if (age < 2) {
      g.fillStyle = "#c9b07a";
      g.fillRect(w * 0.2, h * 0.42, w * 0.6, h * 0.32);
      g.fillStyle = "#7a4a22";
      g.beginPath();
      g.moveTo(w * 0.14, h * 0.46);
      g.lineTo(w * 0.5, h * 0.16);
      g.lineTo(w * 0.86, h * 0.46);
      g.closePath();
      g.fill();
    } else {
      g.fillStyle = "#d4c8a4";
      g.fillRect(w * 0.18, h * 0.4, w * 0.64, h * 0.34);
      g.fillStyle = "#5a2a1c";
      g.beginPath();
      g.moveTo(w * 0.12, h * 0.44);
      g.lineTo(w * 0.5, h * 0.12);
      g.lineTo(w * 0.88, h * 0.44);
      g.closePath();
      g.fill();
      g.strokeStyle = "#8a7a58";
      g.strokeRect(w * 0.18, h * 0.4, w * 0.64, h * 0.34);
    }
    g.fillStyle = "#4a3020";
    g.fillRect(w * 0.44, h * 0.54, w * 0.12, h * 0.2);
    g.fillStyle = color;
    g.fillRect(w * 0.26, h * 0.5, w * 0.12, h * 0.1);
    g.restore();
  },

  barracks(g, x, y, s, age, color, constructing) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "rgba(20,16,10,0.28)";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.74, w * 0.4, h * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = age < 2 ? "#6a4e2c" : "#6a6862";
    g.fillRect(w * 0.14, h * 0.36, w * 0.72, h * 0.4);
    g.fillStyle = age < 2 ? "#4a3218" : "#3a3a38";
    g.fillRect(w * 0.12, h * 0.3, w * 0.76, h * 0.1);
    g.fillStyle = color;
    g.fillRect(w * 0.2, h * 0.18, w * 0.08, h * 0.16);
    g.fillStyle = "#3a2814";
    g.fillRect(w * 0.42, h * 0.5, w * 0.16, h * 0.26);
    g.fillStyle = "#c9b07a";
    g.fillRect(w * 0.62, h * 0.46, w * 0.16, h * 0.12);
    g.restore();
  },

  tower(g, x, y, s, age, color, constructing) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "rgba(20,16,10,0.28)";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.78, w * 0.28, h * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = age < 2 ? "#7a5a32" : "#7a7874";
    g.fillRect(w * 0.3, h * 0.28, w * 0.4, h * 0.5);
    g.fillStyle = age < 2 ? "#5a3a18" : "#4a2a1c";
    g.beginPath();
    g.moveTo(w * 0.24, h * 0.3);
    g.lineTo(w * 0.5, h * 0.08);
    g.lineTo(w * 0.76, h * 0.3);
    g.closePath();
    g.fill();
    g.fillStyle = color;
    g.fillRect(w * 0.42, h * 0.4, w * 0.16, h * 0.1);
    g.fillStyle = "#2a1c10";
    g.fillRect(w * 0.44, h * 0.6, w * 0.12, h * 0.18);
    g.restore();
  },

  lumber(g, x, y, s, age, color, constructing) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "rgba(20,16,10,0.25)";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.76, w * 0.38, h * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = age < 2 ? "#7a5530" : "#6a6860";
    g.fillRect(w * 0.18, h * 0.38, w * 0.5, h * 0.36);
    g.fillStyle = age < 2 ? "#5a3a18" : "#4a2a18";
    g.beginPath();
    g.moveTo(w * 0.12, h * 0.42);
    g.lineTo(w * 0.43, h * 0.16);
    g.lineTo(w * 0.74, h * 0.42);
    g.closePath();
    g.fill();
    g.fillStyle = color;
    g.fillRect(w * 0.28, h * 0.5, w * 0.12, h * 0.1);
    g.fillStyle = "#6a4220";
    g.fillRect(w * 0.58, h * 0.58, w * 0.28, h * 0.1);
    g.fillRect(w * 0.6, h * 0.5, w * 0.24, h * 0.08);
    g.fillRect(w * 0.62, h * 0.43, w * 0.2, h * 0.07);
    g.fillStyle = "#8a5a28";
    g.fillRect(w * 0.6, h * 0.58, w * 0.28, 2);
    g.fillRect(w * 0.62, h * 0.5, w * 0.24, 2);
    g.restore();
  },

  mining(g, x, y, s, age, color, constructing) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "rgba(20,16,10,0.25)";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.76, w * 0.38, h * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = age < 2 ? "#6a5a48" : "#7a7874";
    g.fillRect(w * 0.2, h * 0.4, w * 0.46, h * 0.34);
    g.fillStyle = age < 2 ? "#4a3a28" : "#4a2a1c";
    g.beginPath();
    g.moveTo(w * 0.14, h * 0.44);
    g.lineTo(w * 0.43, h * 0.18);
    g.lineTo(w * 0.72, h * 0.44);
    g.closePath();
    g.fill();
    g.fillStyle = color;
    g.fillRect(w * 0.3, h * 0.5, w * 0.12, h * 0.1);
    g.fillStyle = "#c9a028";
    g.beginPath();
    g.moveTo(w * 0.68, h * 0.62);
    g.lineTo(w * 0.76, h * 0.48);
    g.lineTo(w * 0.88, h * 0.54);
    g.lineTo(w * 0.82, h * 0.68);
    g.closePath();
    g.fill();
    g.fillStyle = "#8a9098";
    g.beginPath();
    g.moveTo(w * 0.72, h * 0.7);
    g.lineTo(w * 0.84, h * 0.58);
    g.lineTo(w * 0.92, h * 0.7);
    g.closePath();
    g.fill();
    g.restore();
  },

  building(g, type, x, y, s, age, color, constructing, extra) {
    if (type === "hall") this.hall(g, x, y, s, age, color, constructing);
    else if (type === "house") this.house(g, x, y, s, age, color, constructing);
    else if (type === "barracks") this.barracks(g, x, y, s, age, color, constructing);
    else if (type === "lumber") this.lumber(g, x, y, s, age, color, constructing);
    else if (type === "mining") this.mining(g, x, y, s, age, color, constructing);
    else if (type === "mill") this.mill(g, x, y, s, age, color, constructing);
    else if (type === "farm") this.farm(g, x, y, s, age, color, constructing, extra);
    else this.tower(g, x, y, s, age, color, constructing);
  },

  mill(g, x, y, s, age, color, constructing) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "rgba(20,16,10,0.25)";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.76, w * 0.36, h * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = age < 2 ? "#c9b07a" : "#d4c8a4";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.52, w * 0.28, h * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = age < 2 ? "#8a6a32" : "#6a2a1c";
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.36, w * 0.3, h * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.fillRect(w * 0.44, h * 0.46, w * 0.12, h * 0.1);
    g.fillStyle = "#e8d7b0";
    g.fillRect(w * 0.18, h * 0.62, w * 0.16, h * 0.1);
    g.fillRect(w * 0.66, h * 0.64, w * 0.14, h * 0.08);
    g.restore();
  },

  farm(g, x, y, s, age, color, constructing, food) {
    const w = s * CFG.tile;
    const h = s * CFG.tile;
    const full = food == null ? 1 : food;
    g.save();
    g.translate(x, y);
    g.globalAlpha = constructing ? 0.7 : 1;
    g.fillStyle = "#6b5334";
    g.fillRect(w * 0.08, h * 0.18, w * 0.84, h * 0.64);
    const rows = age < 2 ? "#4a7a32" : "#c9b24a";
    if (full > 0.04) {
      g.strokeStyle = rows;
      g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const yy = h * 0.26 + i * h * 0.1;
        g.globalAlpha = constructing ? 0.7 : 0.35 + full * 0.65;
        g.beginPath();
        g.moveTo(w * 0.12, yy);
        g.lineTo(w * 0.88, yy + 2);
        g.stroke();
      }
    } else {
      g.fillStyle = "rgba(90, 70, 40, 0.35)";
      g.fillRect(w * 0.1, h * 0.22, w * 0.8, h * 0.56);
    }
    g.globalAlpha = constructing ? 0.7 : 1;
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.strokeRect(w * 0.08, h * 0.18, w * 0.84, h * 0.64);
    g.restore();
  },

  unit(g, u, t) {
    const def = UNIT[u.type];
    const owner = CFG.players[u.owner];
    const gathering = u.state === "gather";
    const working = gathering || u.state === "build";
    const bob = gathering
      ? Math.sin(t * 20 + u.id) * 2.4
      : u.state === "idle"
        ? Math.sin(t * 3 + u.id) * 0.6
        : Math.sin(t * 14 + u.id) * 1.4;
    const ang = u.facing;
    g.save();
    g.translate(u.x, u.y + bob);
    if (working) g.rotate(Math.sin(t * 16 + u.id) * 0.14);
    g.fillStyle = "rgba(20,16,10,0.3)";
    g.beginPath();
    g.ellipse(0, 8, def.radius * 0.7, 3.2, 0, 0, Math.PI * 2);
    g.fill();

    const body = owner.color;
    const dark = owner.colorDark;
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(0, 5, 6.4, 4.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, 1, 7.2, 7.6, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#e8d2b0";
    g.beginPath();
    g.arc(Math.cos(ang) * 1.2, -8 + Math.sin(ang) * 0.4, 4.6, 0, Math.PI * 2);
    g.fill();

    if (u.type === "worker") {
      g.fillStyle = "#6a4a24";
      g.fillRect(-5, -10.5, 10, 3);
      const tool = u.taskRes === "gold" || u.taskRes === "stone" ? "#b0b6be" : "#c9a05a";
      const swing = gathering ? 0.35 + Math.sin(t * 16 + u.id) * 0.95 : 0.8;
      const hx = Math.cos(ang + swing) * 4;
      const hy = 2 + Math.sin(ang + swing) * 1.5;
      const tx = Math.cos(ang + swing) * 13;
      const ty = -5 + Math.sin(t * 16 + u.id) * (gathering ? 4 : 0);
      g.strokeStyle = "#5a3a1c";
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(tx, ty);
      g.stroke();
      g.fillStyle = tool;
      g.beginPath();
      g.arc(tx, ty, gathering ? 3.1 : 2.4, 0, Math.PI * 2);
      g.fill();
      if (gathering && Math.sin(t * 16 + u.id) > 0.65) {
        g.fillStyle = CFG.resources[u.taskRes || "wood"].color;
        g.fillRect(tx + 3, ty - 4, 3, 3);
        g.fillRect(tx - 5, ty - 2, 2, 2);
      }
    } else if (u.type === "archer") {
      g.fillStyle = "#5a3a18";
      g.fillRect(-4, -11, 8, 3);
      g.strokeStyle = "#6a4a24";
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(Math.cos(ang) * 2, -1, 7, ang - 1.1, ang + 1.1);
      g.stroke();
      g.strokeStyle = "#d8dde0";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(Math.cos(ang) * 2, -1);
      g.lineTo(Math.cos(ang) * 13, Math.sin(ang) * 2 - 4);
      g.stroke();
    } else if (u.type === "spearman") {
      g.strokeStyle = "#8a6a3c";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(Math.cos(ang) * 2, 2);
      g.lineTo(Math.cos(ang) * 16, -8);
      g.stroke();
      g.fillStyle = "#c0c4c8";
      g.beginPath();
      g.moveTo(Math.cos(ang) * 16, -10);
      g.lineTo(Math.cos(ang) * 16 + 3, -6);
      g.lineTo(Math.cos(ang) * 16 - 3, -6);
      g.closePath();
      g.fill();
    } else if (u.type === "mage") {
      g.fillStyle = "#5a3a78";
      g.beginPath();
      g.ellipse(0, 2, 7.4, 8.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c9b07a";
      g.fillRect(-2, -2, 4, 9);
      const glow = 0.45 + Math.sin(t * 8 + u.id) * 0.25;
      g.strokeStyle = "#4a2a68";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-7, 7);
      g.lineTo(-9, -12);
      g.stroke();
      g.fillStyle = `rgba(176, 124, 255, ${0.5 + glow})`;
      g.beginPath();
      g.arc(-9, -13, 3.4 + glow, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#d8c6f0";
      g.beginPath();
      g.moveTo(-4, -12);
      g.lineTo(0, -18);
      g.lineTo(4, -12);
      g.closePath();
      g.fill();
    } else if (u.type === "knight") {
      g.fillStyle = "#8a9098";
      g.beginPath();
      g.ellipse(0, 3, 8.2, 7.4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c8ccd0";
      g.beginPath();
      g.arc(Math.cos(ang) * 1.2, -8, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dark;
      g.fillRect(-5, -11, 10, 3);
      g.strokeStyle = "#d0d4d8";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(Math.cos(ang) * 4, 0);
      g.lineTo(Math.cos(ang) * 14, -4);
      g.stroke();
      g.fillStyle = owner.color;
      g.beginPath();
      g.moveTo(-8, 1);
      g.lineTo(-11, 6);
      g.lineTo(-4, 7);
      g.closePath();
      g.fill();
    } else if (u.type === "militia") {
      g.strokeStyle = "#c0c4c8";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(Math.cos(ang) * 3, 0);
      g.lineTo(Math.cos(ang) * 13, -6);
      g.stroke();
      g.fillStyle = "#d8dde0";
      g.beginPath();
      g.moveTo(Math.cos(ang) * 13, -8);
      g.lineTo(Math.cos(ang) * 13 + 3, -4);
      g.lineTo(Math.cos(ang) * 13 - 3, -4);
      g.closePath();
      g.fill();
    } else if (u.type === "scout") {
      g.fillStyle = dark;
      g.beginPath();
      g.arc(0, -8, 5.4, Math.PI, 0);
      g.fill();
      g.fillRect(-5.4, -9, 10.8, 4);
      g.fillStyle = owner.colorDark;
      g.beginPath();
      g.moveTo(-3.5, 1);
      g.lineTo(-8, 11);
      g.lineTo(0, 7);
      g.lineTo(8, 11);
      g.lineTo(3.5, 1);
      g.closePath();
      g.fill();
      g.strokeStyle = "#e8d7b0";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(2, -12);
      g.lineTo(7, -19);
      g.stroke();
      g.fillStyle = "#f0d060";
      g.beginPath();
      g.arc(0, -17, 2.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#6a4a24";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(Math.cos(ang) * 3, 1);
      g.lineTo(Math.cos(ang) * 11, -3);
      g.stroke();
    } else if (u.type === "priest") {
      g.fillStyle = "#efe6c8";
      g.beginPath();
      g.ellipse(0, 3, 7.6, 8.4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = owner.color;
      g.fillRect(-2, -1, 4, 10);
      g.strokeStyle = "rgba(240, 220, 120, 0.9)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, -13, 5.2, 2.1, 0, 0, Math.PI * 2);
      g.stroke();
      const pulse = u.state === "heal" ? 0.55 + Math.sin(t * 10) * 0.45 : 0.3;
      g.strokeStyle = "#8a6a28";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(7, 8);
      g.lineTo(10, -12);
      g.stroke();
      g.fillStyle = `rgba(110, 220, 140, ${0.45 + pulse * 0.5})`;
      g.beginPath();
      g.arc(10, -13, 3.2 + pulse, 0, Math.PI * 2);
      g.fill();
      if (u.state === "heal") {
        g.strokeStyle = "rgba(90, 220, 130, 0.95)";
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(0, -24);
        g.lineTo(0, -15);
        g.moveTo(-4.5, -19.5);
        g.lineTo(4.5, -19.5);
        g.stroke();
      }
    } else {
      g.fillStyle = "#8a9098";
      g.beginPath();
      g.arc(-1, 1, 4.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#d0d4d8";
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(Math.cos(ang) * 3, 0);
      g.lineTo(Math.cos(ang) * 14, -5);
      g.stroke();
    }

    if (u.carryAmount > 0 && u.carryType) {
      const rc = CFG.resources[u.carryType].color;
      g.fillStyle = rc;
      g.fillRect(-4, 6, 8, 4);
    }
    g.restore();
  },

  ghost(g, type, x, y, s, ok) {
    g.save();
    g.globalAlpha = 0.45;
    this.building(g, type, x, y, s, Game.players[0].age, ok ? "#88cc88" : "#cc4444", true);
    g.fillStyle = ok ? "rgba(80,180,80,0.2)" : "rgba(180,40,40,0.25)";
    g.fillRect(x, y, s * CFG.tile, s * CFG.tile);
    g.restore();
  },

  selectRing(g, x, y, r, color) {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(x, y + 7, r + 3, r * 0.45, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  },
};
