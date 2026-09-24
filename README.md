# Mike Androulakis — Portfolio

Static creative-design portfolio.

## Branches

- `main` — clean snapshot imported from ChatGPT Work.
- `work-sandbox` — active site developed and tested in this chat.

All day-to-day edits should happen on `work-sandbox`.

## Local development in VS Code

```bash
git clone https://github.com/manioudakiefpraxia-maker/mike-androulakis-portfolio.git
cd mike-androulakis-portfolio
git switch work-sandbox
npm install
npm run dev
```

Then open the local URL printed by `serve`.

## Structure

```text
dist/
├── index.html
├── css/
│   └── home.css
├── js/
│   ├── app.js
│   ├── audio.js
│   ├── bio.js
│   ├── hero.js
│   ├── menu.js
│   ├── particles.js
│   └── scroll.js
├── cv/
└── <project folders>/
```

The homepage runtime is intentionally modular. Project pages keep their own small CSS files plus shared project styles.

## Workflow

1. Pull the latest `work-sandbox`.
2. Make one focused change.
3. Test locally on desktop and mobile viewport sizes.
4. Commit to `work-sandbox`.
5. Let Vercel create the preview deployment.

Do not merge experimental branches wholesale into `main`.
