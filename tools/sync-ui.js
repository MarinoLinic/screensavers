import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const projects = ['biome-worlds', 'flying-objects-3d', 'liquid-worlds', 'pipes-3d', 'pixel-biomes', 'raycast-maze'];
for (const project of projects) {
  for (const extension of ['css', 'js']) {
    await copyFile(
      fileURLToPath(new URL('../shared/ui.' + extension, import.meta.url)),
      fileURLToPath(new URL('../' + project + '/collection-ui.' + extension, import.meta.url)),
    );
  }
}
console.log('Synced collection UI to all six projects.');
