// Flower Box morph — the simple classic-screensaver alternative to the
// fleet. Pure module: no three import so it runs under node --test.

/**
 * In-place morph of a subdivided unit cube (base coords in [-1,1]).
 * Both buffers are flat [x,y,z]* triples; positions may be a live
 * BufferAttribute array. The scale factor depends only on r2 = x^2+y^2+z^2,
 * so the seam vertices BoxGeometry duplicates along every face edge receive
 * identical factors and stay coincident — the box never cracks open.
 * Symmetric, deterministic, no allocation, max |coord| <= 1.365.
 */
export function deformFlowerBox(basePositions, positions, time) {
  const breathe = Math.sin(time * 0.7);
  const ripple = time * 1.1;
  for (let i = 0; i < basePositions.length; i += 3) {
    const x = basePositions[i];
    const y = basePositions[i + 1];
    const z = basePositions[i + 2];
    const r2 = x * x + y * y + z * z;
    const f = 1 + 0.22 * breathe * (r2 - 1.5) + 0.035 * Math.sin(ripple + 2 * r2);
    positions[i] = x * f;
    positions[i + 1] = y * f;
    positions[i + 2] = z * f;
  }
  return positions;
}
