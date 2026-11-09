// In-page player for the browser games in /xai-arcade-browser-games.
// Cards carry their data in markup:  <article data-game="carCrash" data-touch="false">
// with a .game-title and .game-controls inside; any [data-play] element opens it.
// Deep link: /#play/<game-id>

const GAMES_PATH = 'xai-arcade-browser-games/';
const SOURCE_URL = 'https://github.com/yusufdegerli/yusufdegerli.github.io/tree/main/xai-arcade-browser-games/';

const coarsePointer = window.matchMedia('(pointer: coarse)');

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function canFullscreen() {
  return Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function initArcade() {
  const dialog = document.getElementById('arcade-player');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const iframe = dialog.querySelector('#player-iframe');
  const stage = dialog.querySelector('#player-stage');
  const title = dialog.querySelector('#player-title');
  const controls = dialog.querySelector('#player-controls');
  const sourceLink = dialog.querySelector('#player-source');
  const newTabLink = dialog.querySelector('#player-newtab');
  const notice = dialog.querySelector('#player-notice');
  const fullscreenButton = dialog.querySelector('[data-player="fullscreen"]');

  let current = null; // { id, title, controls, touch }
  let returnFocus = null;

  if (!canFullscreen()) fullscreenButton.hidden = true; // e.g. iPhone Safari

  const announce = (open) => document.dispatchEvent(new CustomEvent('arcadeplayer', { detail: { open } }));

  function readCard(card) {
    return {
      id: card.dataset.game,
      title: card.querySelector('.game-title')?.textContent.trim() || card.dataset.game,
      controls: card.querySelector('.game-controls')?.textContent.trim() || '',
      touch: card.dataset.touch || 'false',
    };
  }

  function gameUrl(id) {
    return `${GAMES_PATH}${id}/`;
  }

  function load() {
    notice.hidden = true;
    stage.classList.remove('is-ready');
    iframe.src = gameUrl(current.id);
  }

  function focusGame() {
    try {
      iframe.contentWindow?.focus();
    } catch {
      iframe.focus();
    }
  }

  iframe.addEventListener('load', () => {
    if (!current || !iframe.getAttribute('src') || iframe.getAttribute('src') === 'about:blank') return;
    stage.classList.add('is-ready');
    focusGame(); // keyboard input goes straight to the game
  });

  function open(card, trigger) {
    current = readCard(card);
    returnFocus = trigger || null;

    title.textContent = current.title;
    iframe.title = current.title;
    controls.textContent = current.controls;
    sourceLink.href = SOURCE_URL + current.id;
    newTabLink.href = gameUrl(current.id);

    document.body.classList.add('player-open');
    dialog.showModal();
    announce(true);

    // Keyboard/mouse games on a phone: explain before loading 1–30 MB of game.
    if (coarsePointer.matches && current.touch === 'false') {
      notice.hidden = false;
      stage.classList.add('is-ready');
      notice.querySelector('button')?.focus();
    } else {
      load();
    }

    history.replaceState(null, '', `#play/${current.id}`);
  }

  function restart() {
    if (!current) return;
    stage.classList.remove('is-ready');
    try {
      iframe.contentWindow.location.reload();
    } catch {
      iframe.src = gameUrl(current.id);
    }
  }

  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      } else {
        await (stage.requestFullscreen?.() ?? stage.webkitRequestFullscreen?.());
      }
    } catch {
      /* refused (no user gesture / unsupported): stay windowed */
    }
    focusGame();
  }

  dialog.addEventListener('close', () => {
    if (fullscreenElement()) (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.())?.catch?.(() => {});
    iframe.removeAttribute('src'); // unload: stops game loops and audio
    iframe.src = 'about:blank';
    stage.classList.remove('is-ready');
    notice.hidden = true;
    document.body.classList.remove('player-open');
    current = null;
    announce(false);
    if (location.hash.startsWith('#play/')) history.replaceState(null, '', location.pathname + location.search);
    returnFocus?.focus({ preventScroll: true });
  });

  // Click on the dimmed backdrop (outside the frame) closes the player.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('click', (event) => {
    const action = event.target.closest('[data-player]')?.dataset.player;
    if (action === 'close') dialog.close();
    if (action === 'restart') restart();
    if (action === 'fullscreen') toggleFullscreen();
    if (action === 'dismiss') load();
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-play]');
    if (!trigger) return;
    const card = trigger.closest('[data-game]');
    if (!card) return;
    event.preventDefault();
    open(card, trigger);
  });

  document.addEventListener('langchange', () => {
    if (!current) return;
    const card = document.querySelector(`[data-game="${CSS.escape(current.id)}"]`);
    if (card) controls.textContent = readCard(card).controls;
  });

  // Deep link: /#play/carCrash — on first load and when the hash changes in place.
  function openFromHash() {
    const match = location.hash.match(/^#play\/([\w-]+)$/);
    if (!match || dialog.open) return;
    const card = document.querySelector(`[data-game="${CSS.escape(match[1])}"]`);
    if (card) open(card, card.querySelector('[data-play]'));
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}
