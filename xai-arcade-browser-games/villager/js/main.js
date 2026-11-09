(() => {
  const canvas = document.getElementById("world");
  const mini = document.getElementById("minimap");

  function start() {
    try {
      SFX.unlock();
    } catch (err) {}
    Game.newMatch();
  }

  document.getElementById("btn-play").addEventListener("click", start);
  document.getElementById("btn-again").addEventListener("click", start);

  Draw.bind(canvas, mini);
  Input.bind(canvas);
  Game.boot();
  UI.showHud(false);
  document.getElementById("minimap").style.display = "none";

  window.addEventListener("error", (e) => {
    window.__errs = window.__errs || [];
    window.__errs.push(e.message);
  });

  if (new URLSearchParams(location.search).has("autostart")) {
    start();
  }

  let last = performance.now();
  function loop(now) {
    const raw = U.clamp((now - last) / 1000, 0, 0.05);
    last = now;
    let acc = Math.min(raw * (Game.speed || 1), 0.2);
    while (acc > 0.0001) {
      const step = Math.min(0.05, acc);
      Game.tick(step);
      acc -= step;
    }
    Draw.frame(now / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
