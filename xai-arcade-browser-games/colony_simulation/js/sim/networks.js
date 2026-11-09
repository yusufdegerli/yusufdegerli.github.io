/** @file Layered electrical, plumbing, and ventilation grids. */

import { BUILDINGS } from "./constants.js";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Networks {
  constructor(world) {
    this.world = world;
    this.circuits = [];
    this.pipeNets = [];
    this.ventNets = [];
    this.autoNets = [];
    this.rev = -1;
  }

  rebuild() {
    const w = this.world;
    if (wireHasCycle(w)) shortCircuit(w);
    this.circuits = flood(w, w.wire, (c) => {
      c.powerW = 0;
      c.demandW = 0;
      c.storageJ = 0;
      c.storedJ = 0;
      c.satisfied = 1;
    });
    this.pipeNets = flood(w, w.pipe, (c) => {
      c.packets = [];
    });
    this.ventNets = flood(w, w.vent, (c) => {
      c.packets = [];
    });
    this.autoNets = flood(w, w.automationWire, (c) => {
      c.signal = 0;
      c.next = 0;
    });
    this.rev = w.networkRev;
    for (const b of w.buildings) {
      b.circuit = netAt(this.circuits, b.x, b.y, w.w) || netAt(this.circuits, b.x + b.w - 1, b.y + b.h - 1, w.w);
      b.pipeNet = netAt(this.pipeNets, b.x, b.y + b.h - 1, w.w) || netAt(this.pipeNets, b.x, b.y, w.w);
      b.ventNet = netAt(this.ventNets, b.x, b.y, w.w) || netAt(this.ventNets, b.x, b.y + b.h - 1, w.w);
      attachAutomation(b, this.autoNets, w);
    }
  }

  step(dt, resources) {
    if (this.rev !== this.world.networkRev) this.rebuild();
    this.stepPower(dt);
    this.stepPipes(dt);
    this.stepVents(dt);
    this.stepAutomation();
  }

  stepAutomation() {
    const world = this.world;
    if (this.rev !== world.networkRev) this.rebuild();
    for (const net of this.autoNets) net.next = 0;

    for (const b of world.buildings) {
      if (b.type === "thermosensor") {
        const i = b.y * world.w + b.x;
        const green = world.temp[i] > (b.threshold || 293.15);
        b.autoGreen = green;
        if (b.autoNet && green) b.autoNet.next = 1;
      } else if (b.type === "notgate") {
        if (b.autoOutNet) b.autoOutNet.next = b.autoOutNet.next || (b.latchedOut ? 1 : 0);
      }
    }

    world.autoSignal.fill(0);
    for (const net of this.autoNets) {
      net.signal = net.next ? 1 : 0;
      for (const i of net.cells) world.autoSignal[i] = net.signal;
    }

    for (const b of world.buildings) {
      if (b.type === "notgate") {
        const input = b.autoInNet ? b.autoInNet.signal : 0;
        b.latchedOut = input ? 0 : 1;
        b.autoGreen = !!b.latchedOut;
      }
      if (b.type === "coalgen" || b.type === "liqpump") {
        b.autoConnected = !!b.autoNet;
        b.autoGreen = !!(b.autoNet && b.autoNet.signal);
      }
    }
  }

  stepPower(dt) {
    for (const c of this.circuits) {
      c.powerW = 0;
      c.demandW = 0;
      c.storageJ = 0;
      c._sumStored = 0;
    }
    for (const b of this.world.buildings) {
      const def = BUILDINGS[b.type];
      if (!def) continue;
      const c = b.circuit;
      if (def.storageJ && c) {
        c.storageJ += def.storageJ;
        c._sumStored += b.storedJ || 0;
      }
      if (def.produceW && b.working && c) c.powerW += def.produceW;
      if (def.power && b.enabled !== false && c) c.demandW += def.power;
    }
    for (const c of this.circuits) {
      const net = c.powerW - c.demandW;
      c.storedJ = Math.max(0, Math.min((c._sumStored || 0) + net * dt, c.storageJ || 0));
      const can = c.powerW * dt + c.storedJ;
      c.satisfied = c.demandW <= 0 ? 1 : Math.min(1, can / (c.demandW * dt + 1e-4));
    }
    for (const b of this.world.buildings) {
      const def = BUILDINGS[b.type];
      if (!def) continue;
      if (def.power && b.enabled !== false) {
        b.powered = !!(b.circuit && b.circuit.satisfied > 0.5);
      } else {
        b.powered = true;
      }
      if (def.storageJ && b.circuit) {
        const share = def.storageJ / (b.circuit.storageJ || 1);
        b.storedJ = (b.circuit.storedJ || 0) * share;
      }
    }
  }

  stepPipes(dt) {
    for (const net of this.pipeNets) {
      if (!net.packets) net.packets = [];
      if (net.packets.length === 0) continue;
      const moved = [];
      for (const p of net.packets) {
        p.t = (p.t || 0) + dt * 6;
        moved.push(p);
      }
      net.packets = moved.slice(-48);
    }
  }

  stepVents(dt) {
    for (const net of this.ventNets) {
      if (!net.packets) net.packets = [];
      if (net.packets.length === 0) continue;
      net.packets = net.packets.slice(-48);
    }
  }

  pushPipe(net, kind, amount) {
    if (!net) return 0;
    net.packets.push({ kind, amount, t: 0 });
    return amount;
  }

  pullPipe(net, amount) {
    if (!net || !net.packets.length) return null;
    const p = net.packets.shift();
    return p;
  }

  pushVent(net, gas, amount) {
    if (!net) return 0;
    net.packets.push({ gas, amount });
    return amount;
  }

  pullVent(net) {
    if (!net || !net.packets.length) return null;
    return net.packets.shift();
  }
}

function flood(world, layer, init) {
  const { w, h, n } = world;
  const seen = new Uint8Array(n);
  const nets = [];
  for (let i = 0; i < n; i++) {
    if (!layer[i] || seen[i]) continue;
    const cells = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const cur = stack.pop();
      cells.push(cur);
      const x = cur % w;
      const y = (cur / w) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (layer[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const net = { id: nets.length, cells };
    if (init) init(net);
    nets.push(net);
  }
  return nets;
}

function wireHasCycle(world) {
  const { w, h, wire } = world;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let i = 0; i < wire.length; i++) {
    if (!wire[i] || seen[i]) continue;
    stack.push(i, -1);
    seen[i] = 1;
    while (stack.length) {
      const parent = stack.pop();
      const cur = stack.pop();
      const x = cur % w;
      const y = (cur / w) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!wire[j]) continue;
        if (j === parent) continue;
        if (seen[j]) return true;
        seen[j] = 1;
        stack.push(j, cur);
      }
    }
  }
  return false;
}

function shortCircuit(world) {
  const layer = world.wire;
  let hop = 0;
  while (true) {
    hop = (hop + 1) | 0;
    layer[hop % layer.length] = layer[hop % layer.length];
  }
}

function attachAutomation(b, nets, world) {
  b.autoNet = null;
  b.autoInNet = null;
  b.autoOutNet = null;
  b.autoConnected = false;
  const { w, h } = world;
  if (b.type === "notgate") {
    b.autoInNet = netTouching(nets, b.x, b.y + b.h - 1, w, h);
    b.autoOutNet = netTouching(nets, b.x, b.y, w, h);
    b.autoConnected = !!(b.autoInNet || b.autoOutNet);
    return;
  }
  if (b.type === "thermosensor") {
    b.autoNet = netTouching(nets, b.x, b.y, w, h);
    b.autoConnected = !!b.autoNet;
    return;
  }
  for (let dy = 0; dy < b.h; dy++) {
    for (let dx = 0; dx < b.w; dx++) {
      const n = netAt(nets, b.x + dx, b.y + dy, w);
      if (n) {
        b.autoNet = n;
        b.autoConnected = true;
        return;
      }
    }
  }
}

function netTouching(nets, x, y, w, h) {
  const direct = netAt(nets, x, y, w);
  if (direct) return direct;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const n = netAt(nets, nx, ny, w);
    if (n) return n;
  }
  return null;
}

function netAt(nets, x, y, w) {
  const i = y * w + x;
  for (const n of nets) {
    if (n.cells.includes(i)) return n;
  }
  return null;
}

export function neighborMask(layer, x, y, w, h) {
  let m = 0;
  if (y > 0 && layer[(y - 1) * w + x]) m |= 1;
  if (x < w - 1 && layer[y * w + x + 1]) m |= 2;
  if (y < h - 1 && layer[(y + 1) * w + x]) m |= 4;
  if (x > 0 && layer[y * w + x - 1]) m |= 8;
  return m;
}
