import { mountAsterhold } from "./asterhold.js";

const app = document.getElementById("app");

function showBootError(err) {
  const pre = document.createElement("pre");
  pre.style.cssText = "position:fixed;inset:20px;background:#1c1624;color:#f0a050;padding:20px;border-radius:12px;z-index:99;white-space:pre-wrap";
  pre.textContent = (err && err.stack) || String(err);
  document.body.appendChild(pre);
}

window.addEventListener("error", (e) => showBootError(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showBootError(e.reason));

try {
  const params = new URLSearchParams(location.search);
  const api = await mountAsterhold(app, { seed: params.has("seed") ? Number(params.get("seed")) : undefined });
  window.__asterhold = api;
  document.documentElement.dataset.ready = "1";
  if (params.get("play") === "1") api.game.begin();
  window.addEventListener("beforeunload", () => api.unmount());
} catch (err) {
  showBootError(err);
}
