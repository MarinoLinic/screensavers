# Vendored dependencies

- `three.module.min.js` and `three.core.min.js` — Three.js **0.175.0**, copied
  byte-for-byte from the sibling project `../pipes-3d/vendor/` in the same
  workspace (originally installed via npm into `../simulation/node_modules/
  three/build/`, https://github.com/mrdoob/three.js). `three.module.min.js`
  imports `./three.core.min.js` relatively, so both files must stay side by
  side.
- `THREE-LICENSE.txt` — the MIT license shipped with that Three.js release.

No CDN, fonts, images, or other network resources are used at runtime.
