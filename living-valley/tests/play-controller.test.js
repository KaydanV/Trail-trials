import test from 'node:test';
import assert from 'node:assert/strict';
import { WALK_BOUNDS, walkDistance, isWalkable, walkablePoint, clearWalkSegment, planWalk, moveOnTrail, integrateWalk } from '../play-controller.js';

const hut = { left: 36, right: 65, top: 45, bottom: 64 };

test('walking integrates the same distance at 30, 60, and 144 Hz', () => {
  function simulate(hz) {
    let velocity = { x: 0, y: 0 }, point = { x: 0, y: 0 };
    for (let frame = 0; frame < hz * 2; frame++) {
      const movement = integrateWalk(velocity, { x: 1, y: 0 }, 1 / hz);
      velocity = movement.velocity; point.x += movement.delta.x;
    }
    return point.x;
  }
  assert.ok(Math.abs(simulate(30) - simulate(144)) < 1e-9);
  assert.ok(Math.abs(simulate(60) - simulate(144)) < 1e-9);
});

test('diagonals and vertical travel have the same pixel speed in portrait and landscape', () => {
  for (const aspect of [0.56, 1.8, 2.4]) {
    const horizontal = integrateWalk({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.1, { aspect });
    for (const input of [{ x: 1, y: 1 }, { x: 0, y: -1 }]) {
      const movement = integrateWalk({ x: 0, y: 0 }, input, 0.1, { aspect });
      assert.ok(Math.abs(walkDistance({ x: 0, y: 0 }, movement.delta, aspect) - horizontal.delta.x) < 1e-9);
    }
  }
});

test('movement starts smoothly and braking settles without overshooting or reversing', () => {
  const start = integrateWalk({ x: 0, y: 0 }, { x: 1, y: 0 }, 1 / 60);
  assert.ok(start.velocity.x > 0 && start.velocity.x < 25);
  let velocity = { x: 25, y: 0 }, total = 0;
  for (let frame = 0; frame < 120; frame++) {
    const movement = integrateWalk(velocity, { x: 0, y: 0 }, 1 / 60);
    assert.ok(movement.velocity.x >= 0 && movement.velocity.x <= velocity.x);
    velocity = movement.velocity; total += movement.delta.x;
  }
  assert.deepEqual(velocity, { x: 0, y: 0 });
  assert.ok(total < 1.2);
});

test('a click behind the hut routes around its solid footprint', () => {
  const start = { x: 18, y: 72 }, goal = { x: 84, y: 48 };
  assert.equal(clearWalkSegment(start, goal, [hut]), false);
  const route = planWalk(start, goal, [hut]);
  assert.ok(route.length >= 2);
  assert.deepEqual(route.at(-1), goal);
  let previous = start;
  for (const point of route) {
    assert.ok(isWalkable(point, [hut]));
    assert.ok(clearWalkSegment(previous, point, [hut]));
    previous = point;
  }
});

test('taps on solid scenery and old saves inside it project to a reachable edge', () => {
  const projected = walkablePoint({ x: 48, y: 58 }, [hut]);
  assert.ok(isWalkable(projected, [hut]));
  const route = planWalk({ x: 18, y: 72 }, { x: 48, y: 58 }, [hut]);
  assert.ok(route.length);
  assert.ok(isWalkable(route.at(-1), [hut]));
});

test('fast movement cannot tunnel across a cabin, and diagonal motion slides along its edge', () => {
  const fast = moveOnTrail({ x: 20, y: 56 }, { x: 65, y: 0 }, [hut]);
  assert.ok(fast.x <= hut.left);
  const sliding = moveOnTrail({ x: 35, y: 56 }, { x: 10, y: 5 }, [hut]);
  assert.ok(sliding.x <= hut.left);
  assert.ok(sliding.y > 60);
  assert.ok(isWalkable(sliding, [hut]));
});

test('corners, bounds and unreachable enclosed routes remain safe', () => {
  assert.deepEqual(moveOnTrail({ x: 6, y: 87 }, { x: -500, y: 500 }), { x: WALK_BOUNDS.left, y: WALK_BOUNDS.bottom });
  const wall = { left: 40, right: 60, top: 44, bottom: 89 };
  assert.deepEqual(planWalk({ x: 20, y: 70 }, { x: 80, y: 70 }, [wall]), []);
  assert.equal(clearWalkSegment({ x: 36, y: 45 }, { x: 36, y: 64 }, [hut]), true);
  assert.equal(isWalkable({ x: 50, y: 58 }, [hut]), false);
});
