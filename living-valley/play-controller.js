/** Pure adventure locomotion. Coordinates are percentages; aspect corrects pixel distance. */
export const WALK_BOUNDS = Object.freeze({ left: 5, right: 95, top: 45, bottom: 88 });
const EPSILON = 0.035;
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value) || 0));
const aspectOf = aspect => clamp(aspect || 1, 0.3, 5);

export function walkDistance(a, b, aspect = 1) {
  return Math.hypot(b.x - a.x, (b.y - a.y) / aspectOf(aspect));
}

export function isWalkable(point, obstacles = [], bounds = WALK_BOUNDS) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom &&
    !obstacles.some(rect => point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom);
}

/** Old saves and taps on a solid prop are safely projected to its nearest outside edge. */
export function walkablePoint(point, obstacles = [], bounds = WALK_BOUNDS, aspect = 1) {
  let result = { x: clamp(point.x, bounds.left, bounds.right), y: clamp(point.y, bounds.top, bounds.bottom) };
  for (let pass = 0; pass <= obstacles.length; pass++) {
    const inside = obstacles.find(rect => result.x > rect.left && result.x < rect.right && result.y > rect.top && result.y < rect.bottom);
    if (!inside) return result;
    const candidates = [
      { x: inside.left - EPSILON, y: result.y }, { x: inside.right + EPSILON, y: result.y },
      { x: result.x, y: inside.top - EPSILON }, { x: result.x, y: inside.bottom + EPSILON },
    ].filter(candidate => isWalkable(candidate, obstacles, bounds));
    candidates.sort((a, b) => walkDistance(result, a, aspect) - walkDistance(result, b, aspect));
    if (!candidates.length) return null;
    result = candidates[0];
  }
  return isWalkable(result, obstacles, bounds) ? result : null;
}

/** Segment visibility includes the whole swept path, so fast frames cannot tunnel through a hut. */
export function clearWalkSegment(a, b, obstacles = []) {
  return !obstacles.some(rect => {
    let entry = 0, exit = 1;
    for (const [axis, minimum, maximum] of [['x', rect.left, rect.right], ['y', rect.top, rect.bottom]]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) {
        if (a[axis] <= minimum || a[axis] >= maximum) return false;
      } else {
        let near = (minimum - a[axis]) / delta, far = (maximum - a[axis]) / delta;
        if (near > far) [near, far] = [far, near];
        entry = Math.max(entry, near); exit = Math.min(exit, far);
        if (entry >= exit) return false;
      }
    }
    return exit > 0 && entry < 1 && entry < exit;
  });
}

/** A tiny visibility graph finds the shortest legal route around solid scenery. */
export function planWalk(start, requested, obstacles = [], bounds = WALK_BOUNDS, aspect = 1) {
  const from = walkablePoint(start, obstacles, bounds, aspect), goal = walkablePoint(requested, obstacles, bounds, aspect);
  if (!from || !goal) return [];
  if (clearWalkSegment(from, goal, obstacles)) return [goal];
  const nodes = [from, goal];
  for (const rect of obstacles) for (const x of [rect.left - EPSILON, rect.right + EPSILON]) {
    for (const y of [rect.top - EPSILON, rect.bottom + EPSILON]) {
      const corner = { x, y };
      if (isWalkable(corner, obstacles, bounds)) nodes.push(corner);
    }
  }
  const distances = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set();
  distances[0] = 0;
  while (visited.size < nodes.length) {
    let nearest = -1;
    nodes.forEach((_, i) => { if (!visited.has(i) && (nearest < 0 || distances[i] < distances[nearest])) nearest = i; });
    if (nearest < 0 || !Number.isFinite(distances[nearest])) break;
    if (nearest === 1) {
      const route = [];
      for (let cursor = 1; cursor !== 0; cursor = previous[cursor]) route.unshift(nodes[cursor]);
      return route;
    }
    visited.add(nearest);
    nodes.forEach((next, index) => {
      if (visited.has(index) || !clearWalkSegment(nodes[nearest], next, obstacles)) return;
      const cost = distances[nearest] + walkDistance(nodes[nearest], next, aspect);
      if (cost < distances[index]) { distances[index] = cost; previous[index] = nearest; }
    });
  }
  return [];
}

/** Keyboard motion slides along solid edges and uses swept collision on every substep. */
export function moveOnTrail(position, delta, obstacles = [], bounds = WALK_BOUNDS, aspect = 1) {
  let result = walkablePoint(position, obstacles, bounds, aspect) || { ...position };
  const slices = Math.max(1, Math.ceil(walkDistance({ x: 0, y: 0 }, delta, aspect) / 0.5));
  const dx = delta.x / slices, dy = delta.y / slices;
  for (let i = 0; i < slices; i++) {
    const full = { x: clamp(result.x + dx, bounds.left, bounds.right), y: clamp(result.y + dy, bounds.top, bounds.bottom) };
    if (isWalkable(full, obstacles, bounds) && clearWalkSegment(result, full, obstacles)) { result = full; continue; }
    const horizontal = { x: full.x, y: result.y };
    if (isWalkable(horizontal, obstacles, bounds) && clearWalkSegment(result, horizontal, obstacles)) result = horizontal;
    const vertical = { x: result.x, y: full.y };
    if (isWalkable(vertical, obstacles, bounds) && clearWalkSegment(result, vertical, obstacles)) result = vertical;
  }
  return result;
}

/** Exponential easing integrates travel exactly across different refresh rates. */
export function integrateWalk(velocity, input, dt, { speed = 25, acceleration = 15, braking = 21, aspect = 1 } = {}) {
  const duration = clamp(dt, 0, 0.1), size = Math.hypot(input.x, input.y), magnitude = Math.min(1, size);
  const heading = size ? { x: input.x / size, y: input.y / size } : { x: 0, y: 0 };
  const desired = { x: heading.x * magnitude * speed, y: heading.y * magnitude * speed };
  const rate = size ? acceleration : braking, decay = Math.exp(-rate * duration), carry = (1 - decay) / rate;
  const next = { x: desired.x + (velocity.x - desired.x) * decay, y: desired.y + (velocity.y - desired.y) * decay };
  if (!size && Math.hypot(next.x, next.y) < 0.06) next.x = next.y = 0;
  return {
    velocity: next,
    delta: { x: desired.x * duration + (velocity.x - desired.x) * carry, y: (desired.y * duration + (velocity.y - desired.y) * carry) * aspectOf(aspect) },
  };
}
