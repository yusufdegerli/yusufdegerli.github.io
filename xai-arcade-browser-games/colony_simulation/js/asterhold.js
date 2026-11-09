/**
 * Asterhold public mount API.
 *
 * Framework usage:
 *   import { mountAsterhold } from "./asterhold.js";
 *   const api = await mountAsterhold(el, { seed });
 *   return () => api.unmount();
 */

import { Game } from "./game.js";

function resolveEl(container) {
  if (!container) throw new Error("mountAsterhold requires a container");
  if (typeof container === "string") {
    const el = document.querySelector(container);
    if (!el) throw new Error("Container not found: " + container);
    return el;
  }
  return container;
}

export async function mountAsterhold(container, options = {}) {
  const el = resolveEl(container);
  const game = new Game(el, options);
  await game.boot();
  return game.getApi();
}

export function unmountAsterhold(api) {
  if (api && typeof api.unmount === "function") api.unmount();
}

export { Game };
