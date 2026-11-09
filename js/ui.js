// Small page behaviours: header state, mobile menu, active section,
// scroll reveal, pointer spotlight and project filters.

export function initHeader(header) {
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

export function initMenu(button, nav) {
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      button.focus();
    }
  });
  window.matchMedia('(min-width: 821px)').addEventListener('change', () => setOpen(false));
}

export function initActiveSection(links) {
  const byId = new Map(links.map((link) => [link.hash.slice(1), link]));
  const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((link) => link.removeAttribute('aria-current'));
        byId.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  sections.forEach((section) => observer.observe(section));
}

export function initReveal() {
  const items = document.querySelectorAll('[data-reveal]');

  // Stagger siblings that share a parent.
  const counters = new Map();
  items.forEach((el) => {
    const n = counters.get(el.parentElement) ?? 0;
    el.style.setProperty('--i', String(Math.min(n, 6)));
    counters.set(el.parentElement, n + 1);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  items.forEach((el) => observer.observe(el));
}

export function initSpotlight() {
  if (!window.matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll('.spotlight').forEach((el) => {
    el.addEventListener('pointermove', (event) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      el.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  });
}

export function initFilters(group, items) {
  const buttons = [...group.querySelectorAll('[data-filter]')];

  const count = (filter) =>
    filter === 'all' ? items.length : items.filter((item) => item.dataset.cat.split(' ').includes(filter)).length;

  buttons.forEach((button) => {
    const badge = document.createElement('span');
    badge.className = 'filter-count';
    badge.textContent = String(count(button.dataset.filter));
    badge.setAttribute('aria-hidden', 'true');
    button.append(badge);
  });

  const apply = (filter) => {
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    items.forEach((item) => {
      const show = filter === 'all' || item.dataset.cat.split(' ').includes(filter);
      const wasHidden = item.hidden;
      item.hidden = !show;
      item.classList.remove('is-entering');
      if (show && wasHidden) {
        void item.offsetWidth; // restart the entrance animation
        item.classList.add('is-entering');
      }
    });
  };

  group.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (button) apply(button.dataset.filter);
  });
}
