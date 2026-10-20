# +1 HEIGHT FLYING TESLA CLICKER

Three.js + TypeScript + Vite browser game.

## Play online
The public game is hosted on [GitHub Pages](https://ethankabiri.github.io/flying-tesla-clicker/). Google and other search engines may take time to index a new site; the direct link is the fastest way to play.

## Run
```
cd flying-tesla
npm install
npm run dev      # open the printed URL (http://localhost:5173)
npm run build && npm run preview   # production build
```
(Node 18+; on this machine: `export PATH=~/.nvm/versions/node/v20.20.2/bin:$PATH`.)

## Deploy
Pushing to `main` builds and publishes the game to GitHub Pages through `.github/workflows/deploy.yml`.

## Controls
- **W/S** drive/brake, **A/D** steer
- **SPACE** train (+1 power × upgrades × rebirth, with a small hop); in the air hold to **glide**
- Air: **W/S** flip, **A/D** turn
- **1/2/3** training focus (Height / Flip / Distance), **B/Tab** shop, **R** reset car

## Loop
Train → drive up a ramp (launch height = ramp slope·speed + height power × vehicle × launch upgrades) → flip/glide → land cleanly for coins (height, flips, distance) → buy 7 upgrades and unlock 12 vehicles → Rebirth for a permanent ×0.5 bonus per rebirth. Autosaves to localStorage.

## Limits
Custom arcade physics (no Rapier/React/Zustand — vanilla TS keeps it small); bloom postprocessing included; no mobile/touch controls.
