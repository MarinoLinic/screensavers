# Vendored dependencies

- `three.module.min.js` and `three.core.min.js` — Three.js **0.175.0**, copied
  byte-for-byte from the sibling project directory in the same workspace:
  `../simulation/node_modules/three/build/` relative to this project root
  (originally installed via npm, https://github.com/mrdoob/three.js).
  `three.module.min.js` imports `./three.core.min.js` relatively, so both
  files must stay side by side.
- `THREE-LICENSE.txt` — the MIT license shipped with that Three.js release.

No CDN, fonts, images, or other network resources are used at runtime.
