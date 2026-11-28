export function createRunData(scenarioId) {
  return {
    scenarioId,
    memo: "",
    collectedClues: [],
    investigatedObjects: [],
    requestedQuestions: [],
    computerPages: [],
    answer: "",
    submission: { verdict: null, reason: "", actions: {} },
    lastSubmission: null,
    evaluation: null,
    playerPosition: { x: 524.5, y: 930 },
  };
}
export function rememberOnce(list, value) {
  if (!list.includes(value)) list.push(value);
}
// 동일 거리면 배열에서 앞선 항목 하나를 유지합니다.
export function nearestObject(player, objects, range) {
  let nearest = null,
    shortest = range;
  for (const object of objects) {
    // Measure the gap between visible rectangles, not object centers.
    const dx = Math.max(0, Math.abs(player.x - object.x) - ((player.displayWidth ?? player.w ?? 0) + (object.w ?? 0)) / 2);
    const dy = Math.max(0, Math.abs(player.y - object.y) - ((player.displayHeight ?? player.h ?? 0) + (object.h ?? 0)) / 2);
    // Investigation starts below the object. Icons use independent coordinates.
    if (object.approachFrom === "below") {
      const bottom = object.y + (object.h ?? 0) / 2;
      if (player.y < bottom || dx > (object.approachPadding ?? 120)) continue;
    }
    const distance = Math.hypot(dx, dy);
    if (distance <= (object.interactionRange ?? range) && (nearest === null || distance < shortest)) {
      nearest = object;
      shortest = distance;
    }
  }
  return nearest;
}

// scenario 4 is lodging/travel booking; all other scenarios begin at the phone.
export function initialGuideTarget(run) {
  const id = Number(run.scenarioId) === 4 ? "computer" : "smartphone";
  return run.investigatedObjects.includes(id) ? null : id;
}

export function investigationLockReason(run, objectId) {
  const first = initialGuideTarget(run);
  if (first === "computer" && objectId === "smartphone") return "먼저 전구가 표시된 컴퓨터를 조사하세요.";
  if (first === "smartphone" && objectId === "computer") return "먼저 전구가 표시된 스마트폰을 조사하세요.";
  return null;
}
