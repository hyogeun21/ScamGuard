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
    playerPosition: { x: 960, y: 760 },
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
    const distance = Math.hypot(player.x - object.x, player.y - object.y);
    if (distance <= range && (nearest === null || distance < shortest)) {
      nearest = object;
      shortest = distance;
    }
  }
  return nearest;
}
