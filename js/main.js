import { initI18n, t } from './i18n.js';
import { initTheme } from './theme.js';
import { initHeader, initMenu, initActiveSection, initReveal, initSpotlight, initFilters } from './ui.js';
import { initCopy, initContactForm } from './contact.js';
import { initArcade } from './arcade.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

await initI18n($('#lang-toggle'));
initTheme($('#theme-toggle'), t);

initHeader($('.site-header'));
initMenu($('#menu-toggle'), $('#site-nav'));
initActiveSection($$('.nav-link'));
initReveal();
initSpotlight();
initFilters($('.filters'), $$('.project'));
initCopy($('.copy-btn'), t);
initContactForm($('#contact-form'), t);
initArcade();

// Interactive canvases are loaded on demand, shortly before they scroll into view.
const demos = {
  liquid: () => import('./lab/liquid.js'),
  raycaster: () => import('./lab/raycaster.js'),
  physics: () => import('./lab/physics.js'),
};

const demoObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      demoObserver.unobserve(entry.target);
      const root = entry.target;
      demos[root.dataset.demo]?.()
        .then((module) => module.mount(root, t))
        .catch((error) => console.warn(`Demo "${root.dataset.demo}" failed to start`, error));
    }
  },
  { rootMargin: '300px 0px' },
);

$$('[data-demo]').forEach((root) => demoObserver.observe(root));
