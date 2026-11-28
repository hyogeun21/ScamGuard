// Phaser 화면 좌표의 직사각형 충돌. 플레이어 전체 표시 영역이 경계를 넘지 않습니다.
// 축별 경로를 검사하므로 큰 이동량도 얇은 오브젝트를 관통하지 않습니다.
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function overlaps(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w - 1e-8 &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h - 1e-8
  );
}
export function isSafePosition(p, size, bounds, solids) {
  return (
    p.x - size.w / 2 >= bounds.x - 1e-8 &&
    p.x + size.w / 2 <= bounds.x + bounds.w + 1e-8 &&
    p.y - size.h / 2 >= bounds.y - 1e-8 &&
    p.y + size.h / 2 <= bounds.y + bounds.h + 1e-8 &&
    !solids.some((s) => overlaps({ ...p, ...size }, s))
  );
}
export function safeSpawn(wanted, size, bounds, solids) {
  if (size.w > bounds.w || size.h > bounds.h)
    throw new Error("플레이어 크기가 이동 영역보다 큽니다.");
  const fit = (p) => ({
    x: clamp(p.x, bounds.x + size.w / 2, bounds.x + bounds.w - size.w / 2),
    y: clamp(p.y, bounds.y + size.h / 2, bounds.y + bounds.h - size.h / 2),
  });
  const p = fit(wanted);
  if (isSafePosition(p, size, bounds, solids)) return p;
  const candidates = [
    { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
  ];
  for (const s of solids)
    candidates.push(
      { x: s.x - (s.w + size.w) / 2, y: p.y },
      { x: s.x + (s.w + size.w) / 2, y: p.y },
      { x: p.x, y: s.y - (s.h + size.h) / 2 },
      { x: p.x, y: s.y + (s.h + size.h) / 2 },
    );
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
  );
  for (const candidate of candidates) {
    const q = fit(candidate);
    if (isSafePosition(q, size, bounds, solids)) return q;
  }
  for (
    let y = bounds.y + size.h / 2;
    y <= bounds.y + bounds.h - size.h / 2;
    y += 16
  )
    for (
      let x = bounds.x + size.w / 2;
      x <= bounds.x + bounds.w - size.w / 2;
      x += 16
    ) {
      const q = { x, y };
      if (isSafePosition(q, size, bounds, solids)) return q;
    }
  throw new Error(
    "이동 가능한 시작 위치가 없습니다. 방 충돌 설정을 확인하세요.",
  );
}
export function moveWithCollisions(position, movement, size, bounds, solids) {
  const start = isSafePosition(position, size, bounds, solids)
    ? position
    : safeSpawn(position, size, bounds, solids);
  let x = clamp(
      start.x + movement.x,
      bounds.x + size.w / 2,
      bounds.x + bounds.w - size.w / 2,
    ),
    y = start.y;
  for (const s of solids) {
    if (Math.abs(y - s.y) * 2 >= size.h + s.h - 1e-8) continue;
    if (movement.x > 0 && start.x + size.w / 2 <= s.x - s.w / 2 + 1e-8)
      x = Math.min(x, s.x - (s.w + size.w) / 2);
    if (movement.x < 0 && start.x - size.w / 2 >= s.x + s.w / 2 - 1e-8)
      x = Math.max(x, s.x + (s.w + size.w) / 2);
  }
  let nextY = clamp(
    y + movement.y,
    bounds.y + size.h / 2,
    bounds.y + bounds.h - size.h / 2,
  );
  for (const s of solids) {
    if (Math.abs(x - s.x) * 2 >= size.w + s.w - 1e-8) continue;
    if (movement.y > 0 && y + size.h / 2 <= s.y - s.h / 2 + 1e-8)
      nextY = Math.min(nextY, s.y - (s.h + size.h) / 2);
    if (movement.y < 0 && y - size.h / 2 >= s.y + s.h / 2 - 1e-8)
      nextY = Math.max(nextY, s.y + (s.h + size.h) / 2);
  }
  return { x, y: nextY };
}
