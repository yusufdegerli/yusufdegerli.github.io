/** @file Player designations become jobs the crew can claim. */

import { DES, BUILDINGS, MATERIALS, isDiggableMat, MAT } from "./constants.js";
import { placeBuilding, canPlace, removeBuilding, buildingAt } from "./buildings.js";

let _jid = 1;

export class JobBoard {
  constructor(world, resources, particles) {
    this.world = world;
    this.resources = resources;
    this.particles = particles;
    this.jobs = [];
  }

  syncFromDesignations() {
    const { w, h, desig } = this.world;
    const seen = new Set(this.jobs.filter((j) => !j.done).map((j) => j.key));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = desig[y * w + x];
        if (d === DES.DIG) {
          const key = `dig:${x},${y}`;
          if (!seen.has(key) && isDiggableMat(this.world.material[y * w + x])) {
            this.jobs.push({
              id: _jid++, key, type: "dig", x, y, priority: 5, assigned: null, done: false, progress: 0,
            });
          }
        } else if (d === DES.DECON) {
          const key = `decon:${x},${y}`;
          if (!seen.has(key)) {
            this.jobs.push({
              id: _jid++, key, type: "decon", x, y, priority: 4, assigned: null, done: false, progress: 0,
            });
          }
        }
      }
    }
    this.jobs = this.jobs.filter((j) => {
      if (j.done) return false;
      if (j.type === "dig") {
        const still = this.world.desig[j.y * w + j.x] === DES.DIG && isDiggableMat(this.world.material[j.y * w + j.x]);
        if (!still) {
          if (j.assigned) j.assigned.job = null;
          return false;
        }
      }
      if (j.type === "decon") {
        const still = this.world.desig[j.y * w + j.x] === DES.DECON;
        if (!still) {
          if (j.assigned) j.assigned.job = null;
          return false;
        }
      }
      return true;
    });
  }

  queueBuild(type, x, y) {
    const def = BUILDINGS[type];
    if (!def) return null;
    if (def.layer) {
      if (this.world[def.layer][y * this.world.w + x]) return null;
    } else if (!canPlace(this.world, type, x, y)) {
      return null;
    }
    const key = `build:${type}:${x},${y}`;
    if (this.jobs.some((j) => j.key === key && !j.done)) return null;
    const job = {
      id: _jid++, key, type: "build", build: type, x, y, w: def.w, h: def.h,
      priority: 6, assigned: null, done: false, progress: 0, cost: { ...def.cost },
    };
    this.jobs.push(job);
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        if (this.world.in(x + dx, y + dy)) this.world.desig[(y + dy) * this.world.w + x + dx] = DES.BUILD;
      }
    }
    return job;
  }

  cancelRect(x0, y0, x1, y1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (let y = ay; y <= by; y++) {
      for (let x = ax; x <= bx; x++) {
        if (!this.world.in(x, y)) continue;
        this.world.clearDesignation(x, y);
      }
    }
    for (const j of this.jobs) {
      if (j.x >= ax && j.x <= bx && j.y >= ay && j.y <= by) {
        j.done = true;
        if (j.assigned) j.assigned.job = null;
      }
    }
  }

  paintDig(x0, y0, x1, y1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (let y = ay; y <= by; y++) {
      for (let x = ax; x <= bx; x++) {
        if (!this.world.in(x, y)) continue;
        if (isDiggableMat(this.world.material[y * this.world.w + x])) {
          this.world.designate(x, y, DES.DIG);
        }
      }
    }
    this.syncFromDesignations();
  }

  paintDecon(x0, y0, x1, y1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (let y = ay; y <= by; y++) {
      for (let x = ax; x <= bx; x++) {
        if (!this.world.in(x, y)) continue;
        const b = buildingAt(this.world, x, y);
        const i = y * this.world.w + x;
        if (b || this.world.wire[i] || this.world.pipe[i] || this.world.vent[i] || this.world.automationWire[i] || MATERIALS[this.world.material[i]]?.built) {
          this.world.designate(x, y, DES.DECON);
        }
      }
    }
    this.syncFromDesignations();
  }

  claim(colonist) {
    let best = null, bd = 1e9;
    for (const j of this.jobs) {
      if (j.done || j.assigned) continue;
      if (j.type === "build" && !this.canAfford(j)) continue;
      const d = Math.abs(j.x - colonist.tx) + Math.abs(j.y - colonist.ty);
      const score = d - j.priority * 4;
      if (score < bd) { bd = score; best = j; }
    }
    if (best) {
      best.assigned = colonist;
      colonist.job = best;
    }
    return best;
  }

  canAfford(job) {
    if (!job.cost) return true;
    for (const [k, v] of Object.entries(job.cost)) {
      if ((this.resources[k] || 0) < v) return false;
    }
    return true;
  }

  work(colonist, job, dt, skill) {
    if (!job || job.done) return;
    if (job.type === "dig") {
      const i = job.y * this.world.w + job.x;
      const mat = this.world.material[i];
      if (!isDiggableMat(mat)) { this.finish(job); return; }
      const hard = MATERIALS[mat].hardness || 1;
      job.progress += dt * 28 * skill / hard;
      this.world.digProg[i] = job.progress;
      if (this.particles && Math.random() < dt * 8) {
        this.particles.spawn(job.x * 32 + 16, job.y * 32 + 16, (Math.random() - 0.5) * 30, -20, 0.4, 2.5, "dust", 160, 110, 80, colonist.id);
      }
      if (job.progress >= 100) this.completeDig(job);
    } else if (job.type === "build") {
      if (!this.canAfford(job)) return;
      job.progress += dt * 36 * skill;
      if (job.progress >= 100) this.completeBuild(job);
    } else if (job.type === "decon") {
      job.progress += dt * 40 * skill;
      if (job.progress >= 100) this.completeDecon(job);
    } else if (job.type === "operate") {
      /* held by colonist AI */
    } else if (job.type === "harvest") {
      job.progress += dt * 50;
      if (job.progress >= 100) {
        const b = job.building;
        if (b && b.type === "farm") {
          this.resources.food += 1200;
          b.grow = 0;
        }
        this.finish(job);
      }
    }
  }

  completeDig(job) {
    const i = job.y * this.world.w + job.x;
    const mat = this.world.material[i];
    const def = MATERIALS[mat];
    if (def.resource) {
      this.resources[def.resource] = (this.resources[def.resource] || 0) + (def.yield || 40);
    }
    const t = this.world.temp[i];
    this.world.material[i] = MAT.VACUUM;
    this.world.mass[i] = 0;
    this.world.clearDesignation(job.x, job.y);
    this.world.temp[i] = t;
    this.world.markDirty(job.x, job.y);
    if (this.particles) this.particles.burst(job.x * 32 + 16, job.y * 32 + 16, "dust", 12);
    this.finish(job);
  }

  completeBuild(job) {
    if (job.cost) {
      for (const [k, v] of Object.entries(job.cost)) {
        this.resources[k] = Math.max(0, (this.resources[k] || 0) - v);
      }
    }
    placeBuilding(this.world, job.build, job.x, job.y, true);
    for (let dy = 0; dy < (job.h || 1); dy++) {
      for (let dx = 0; dx < (job.w || 1); dx++) {
        this.world.clearDesignation(job.x + dx, job.y + dy);
      }
    }
    if (this.particles) this.particles.burst(job.x * 32 + 16, job.y * 32 + 16, "spark", 8);
    this.finish(job);
  }

  completeDecon(job) {
    const b = buildingAt(this.world, job.x, job.y);
    if (b) {
      const def = BUILDINGS[b.type];
      if (def?.cost) {
        for (const [k, v] of Object.entries(def.cost)) {
          this.resources[k] = (this.resources[k] || 0) + Math.round(v * 0.5);
        }
      }
      removeBuilding(this.world, b, this.particles);
    }
    const i = job.y * this.world.w + job.x;
    if (this.world.wire[i]) { this.world.wire[i] = 0; this.world.networkRev++; }
    if (this.world.pipe[i]) { this.world.pipe[i] = 0; this.world.networkRev++; }
    if (this.world.vent[i]) { this.world.vent[i] = 0; this.world.networkRev++; }
    if (this.world.automationWire[i]) { this.world.automationWire[i] = 0; this.world.networkRev++; }
    const mat = this.world.material[i];
    if (MATERIALS[mat]?.built) {
      this.world.material[i] = MAT.VACUUM;
      this.world.mass[i] = 0;
      this.world.markDirty(job.x, job.y);
    }
    this.world.clearDesignation(job.x, job.y);
    this.finish(job);
  }

  finish(job) {
    job.done = true;
    if (job.assigned) {
      job.assigned.job = null;
      job.assigned.path = null;
    }
    job.assigned = null;
  }

  harvestJobs() {
    for (const b of this.world.buildings) {
      if (b.type === "farm" && b.grow >= 280) {
        const key = `harvest:${b.id}`;
        if (!this.jobs.some((j) => j.key === key && !j.done)) {
          this.jobs.push({
            id: _jid++, key, type: "harvest", x: b.x, y: b.y, building: b,
            priority: 7, assigned: null, done: false, progress: 0,
          });
        }
      }
    }
  }
}
