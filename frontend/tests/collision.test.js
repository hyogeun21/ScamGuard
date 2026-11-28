import test from "node:test";
import assert from "node:assert/strict";
import {
  moveWithCollisions,
  isSafePosition,
  safeSpawn,
} from "../src/game/collision.js";
const bounds = { x: 0, y: 0, w: 400, h: 300 },
  size = { w: 40, h: 60 },
  solids = [{ x: 200, y: 150, w: 20, h: 120 }];
test("캐릭터 전체 크기가 네 방향의 방 경계를 넘지 않는다", () => {
  for (const delta of [
    { x: 9999, y: 0 },
    { x: -9999, y: 0 },
    { x: 0, y: 9999 },
    { x: 0, y: -9999 },
    { x: 9999, y: 9999 },
  ]) {
    const p = moveWithCollisions({ x: 80, y: 80 }, delta, size, bounds, []);
    assert.ok(isSafePosition(p, size, bounds, []));
  }
});
test("얇은 물체를 빠르게 지나치려 해도 앞면에서 정지한다", () => {
  assert.equal(
    moveWithCollisions(
      { x: 80, y: 150 },
      { x: 3000, y: 0 },
      size,
      bounds,
      solids,
    ).x,
    170,
  );
  assert.equal(
    moveWithCollisions(
      { x: 320, y: 150 },
      { x: -3000, y: 0 },
      size,
      bounds,
      solids,
    ).x,
    230,
  );
  assert.equal(
    moveWithCollisions(
      { x: 200, y: 40 },
      { x: 0, y: 1000 },
      size,
      bounds,
      solids,
    ).y,
    60,
  );
  assert.equal(
    moveWithCollisions(
      { x: 200, y: 260 },
      { x: 0, y: -1000 },
      size,
      bounds,
      solids,
    ).y,
    240,
  );
});
test("오브젝트 가장자리 접촉, 대각선 이동과 반복 이동에도 겹치지 않는다", () => {
  let p = { x: 80, y: 80 };
  let seed = 1;
  for (let i = 0; i < 3000; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const dx = (seed % 1001) - 500;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const dy = (seed % 1001) - 500;
    p = moveWithCollisions(p, { x: dx, y: dy }, size, bounds, solids);
    assert.ok(isSafePosition(p, size, bounds, solids));
  }
});
test("저장 위치가 방 밖/오브젝트 안이면 안전한 위치로 복구한다", () => {
  for (const wanted of [
    { x: -500, y: 999 },
    { x: 200, y: 150 },
  ])
    assert.ok(
      isSafePosition(
        safeSpawn(wanted, size, bounds, solids),
        size,
        bounds,
        solids,
      ),
    );
});
