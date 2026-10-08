// Broad phase only. Callers retain their original exact predicates and order.
// Centers are immutable until rebuild; opened/dead entries may remain as extras.
export function createOrderedGrid(cellSize = 128) {
  let rows = new Map(), items = [], maxRadius = 0;
  function rebuild(list, radius = () => 0) {
    rows = new Map(); items = list; maxRadius = 0;
    for (let i = 0; i < items.length; i++) {
      const e = items[i], cx = Math.floor(e.x / cellSize), cy = Math.floor(e.y / cellSize);
      let row = rows.get(cy); if (!row) rows.set(cy, row = new Map());
      let bucket = row.get(cx); if (!bucket) row.set(cx, bucket = []);
      bucket.push(i); maxRadius = Math.max(maxRadius, radius(e));
    }
  }
  function candidates(x, y, radius, after = -1) {
    const reach = radius + maxRadius;
    // One whole extra cell on each side protects floating-point cell boundaries.
    // Exceptional inputs take the full scan rather than omitting any candidates.
    if (![x,y,reach].every(Number.isFinite) || reach < 0 || reach / cellSize > 128 || Math.abs(x / cellSize) > 2 ** 40 || Math.abs(y / cellSize) > 2 ** 40)
      return items.map((_,i)=>i).filter(i=>i>after);
    const left = Math.floor((x - reach) / cellSize) - 1, right = Math.floor((x + reach) / cellSize) + 1;
    const top = Math.floor((y - reach) / cellSize) - 1, bottom = Math.floor((y + reach) / cellSize) + 1;
    const out = [];
    for (let cy = top; cy <= bottom; cy++) {
      const row = rows.get(cy); if (!row) continue;
      for (let cx = left; cx <= right; cx++) {
        const bucket = row.get(cx); if (bucket) for (const i of bucket) if (i > after) out.push(i);
      }
    }
    return out.sort((a,b)=>a-b);
  }
  return { rebuild, candidates, get items() { return items; } };
}

// A collision can move the center into a later obstacle outside the first query.
// Re-query ONLY the unprocessed suffix after each movement; never revisit earlier
// obstacles. This reproduces a single sequential full-array pass, including chains.
export function visitMovingObstacles(grid, ent, radius, visit) {
  let after = -1;
  while (true) {
    const candidates = grid.candidates(ent.x, ent.y, radius, after);
    let moved = false;
    for (const i of candidates) {
      after = i;
      if (visit(grid.items[i])) { moved = true; break; }
    }
    if (!moved) return;
  }
}

// Clear each synchronous update, including in-place profile edits between ticks.
export function createTickValueCache(compute) {
  let profile, values = new Map();
  return {
    begin(p) { profile = p; values.clear(); },
    get(p, id) {
      if (p !== profile) { profile = p; values.clear(); }
      if (!values.has(id)) values.set(id, compute(p, id));
      return values.get(id);
    }
  };
}
