# yusufdegerli.github.io

Personal site of Yusuf Değerli, software engineer (frontend, interactive graphics, AI evaluation).
Live at <https://yusufdegerli.github.io/>.

Hand-written HTML, CSS and vanilla ES modules. No framework, no build step: GitHub Pages serves the repository root as-is.

## Structure

```
index.html            all content (English is authored here)
i18n/tr.json          Turkish strings, keyed by data-i18n / data-i18n-attr
css/style.css         design tokens (type scale, spacing, colour themes) + components
js/main.js            entry point; lazy-loads the canvas demos
js/i18n.js            EN/TR switching without duplicating markup
js/theme.js           dark/light theme (OS default, remembered override)
js/ui.js              header, mobile menu, active section, reveal, filters
js/contact.js         copy-to-clipboard + EmailJS form (EmailJS loads on first use)
js/lab/runner.js      fixed-timestep loop; pauses off-screen; respects reduced motion
js/lab/liquid.js      cellular-automata liquid (hero, fig.01)
js/lab/raycaster.js   DDA raycaster (fig.02)
js/lab/physics.js     Verlet physics with constraints (fig.03)
assets/               favicon and optimised images
```

## Run locally

ES modules need an HTTP server (opening the file directly won't work):

```bash
python3 -m http.server 8420
```

Then open <http://localhost:8420>. Append `?lang=tr` to start in Turkish.

## Editing content

- Change English text directly in `index.html`.
- If the element has a `data-i18n="key"`, update the same key in `i18n/tr.json`.
- New project cards: copy an existing `<article class="project">`, and set `data-cat` to one or more of `web`, `mobile`, `systems`. The filter counts update automatically.
