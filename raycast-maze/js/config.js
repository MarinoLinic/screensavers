(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};
  Maze3D.CONFIG = Object.freeze({
    fov: Math.PI / 3,
    moveSpeed: 2.35,
    strafeSpeed: 1.9,
    turnSpeed: 2.15,
    autoTurnSpeed: 3.45,
    autoAcceleration: 16,
    mouseSensitivity: 0.00235,
    playerRadius: 0.2,
    acceleration: 10,
    maxFrameTime: 0.05,
  });
  Maze3D.TILES = Object.freeze({ EMPTY: 0, WALL: 1, EXIT: 2, MOSS: 3, TECH: 4 });

  const TILES = Maze3D.TILES;

  Maze3D.isWallTile = tile =>
    tile === TILES.WALL || tile === TILES.MOSS || tile === TILES.TECH;

  // Out-of-bounds cells are solid.
  Maze3D.isWallCell = (map, cellX, cellY) => {
    if (cellY < 0 || cellY >= map.length) return true;
    const row = map[cellY];
    if (!row || cellX < 0 || cellX >= row.length) return true;
    return Maze3D.isWallTile(row[cellX]);
  };

  // Grid DDA between two world positions: true when every cell on the
  // segment is passable. Diagonal boundary crossings only count when both
  // orthogonal neighbors are open, so sight can never leak through corners.
  Maze3D.hasLineOfSight = (map, fromX, fromY, toX, toY) => {
    if (!map || !map.length) return false;
    if (!Number.isFinite(fromX) || !Number.isFinite(fromY) ||
        !Number.isFinite(toX) || !Number.isFinite(toY)) return false;
    let cellX = Math.floor(fromX);
    let cellY = Math.floor(fromY);
    const endX = Math.floor(toX);
    const endY = Math.floor(toY);
    if (Maze3D.isWallCell(map, cellX, cellY) ||
        Maze3D.isWallCell(map, endX, endY)) return false;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    let tMaxX = dx === 0 ? Infinity
      : (dx > 0 ? cellX + 1 - fromX : fromX - cellX) * deltaX;
    let tMaxY = dy === 0 ? Infinity
      : (dy > 0 ? cellY + 1 - fromY : fromY - cellY) * deltaY;

    const maxSteps = Math.abs(endX - cellX) + Math.abs(endY - cellY) + 1;
    for (let i = 0; i < maxSteps; i += 1) {
      if (cellX === endX && cellY === endY) return true;
      if (Math.abs(tMaxX - tMaxY) <= 1e-10) {
        // Exact corner crossing: stepping both axes is only allowed when
        // neither orthogonal neighbor is a wall.
        if (Maze3D.isWallCell(map, cellX + stepX, cellY) ||
            Maze3D.isWallCell(map, cellX, cellY + stepY)) return false;
        cellX += stepX;
        cellY += stepY;
        tMaxX += deltaX;
        tMaxY += deltaY;
      } else if (tMaxX < tMaxY) {
        cellX += stepX;
        tMaxX += deltaX;
      } else {
        cellY += stepY;
        tMaxY += deltaY;
      }
      if (Maze3D.isWallCell(map, cellX, cellY)) return false;
    }
    return cellX === endX && cellY === endY;
  };

  Maze3D.isEditableTarget = target => {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
      !!target.isContentEditable;
  };
})();
