/** @file Image loading, magenta keying, and sprite prep. */

export class Assets {
  constructor() {
    this.images = new Map();
    this.sprites = new Map();
  }

  async loadAll() {
    const tiles = ["rock", "hardrock", "dirt", "ore", "ice", "coal", "organic", "cave_bg"];
    const sprites = ["colonist_rhea", "colonist_malik", "colonist_jun", "colonist_vesper"];
    const buildings = ["oxygen", "generator", "battery"];
    const jobs = [];
    for (const t of tiles) jobs.push(this._load(`assets/tiles/${t}.jpg`).then((im) => this.images.set(t, im)));
    for (const s of sprites) {
      jobs.push(this._load(`assets/sprites/${s}.jpg`).then((im) => {
        this.sprites.set(s, keyMagenta(im, true));
      }));
    }
    for (const b of buildings) {
      jobs.push(this._load(`assets/buildings/${b}.jpg`).then((im) => {
        this.sprites.set(b, keyMagenta(im, true));
      }));
    }
    await Promise.all(jobs);
    return this;
  }

  _load(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Failed to load " + src));
      im.src = src;
    });
  }

  tile(name) {
    return this.images.get(name);
  }

  sprite(name) {
    return this.sprites.get(name);
  }

  destroy() {
    this.images.clear();
    this.sprites.clear();
  }
}

export function keyMagenta(img, crop = false) {
  const w = img.width, h = img.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const mag = r > 165 && b > 155 && g < 175 && Math.abs(r - b) < 80;
    const pink = (r + b - 2 * g) > 110 && r > 190 && g < 190;
    if (mag || pink) {
      p[i + 3] = 0;
    } else {
      const x = (i / 4) % w;
      const y = ((i / 4) / w) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(data, 0, 0);
  if (!crop || maxX <= minX) return c;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d").drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
