import test from "node:test";
import assert from "node:assert/strict";
import {
  createRunData,
  nearestObject,
  rememberOnce,
} from "../src/game/state.js";
test("새 게임은 이전 플레이의 데이터와 참조를 초기화한다", () => {
  const old = createRunData(1);
  old.memo = "이전 메모";
  old.investigatedObjects.push("notebook");
  old.requestedQuestions.push("q1");
  old.collectedClues.push("clue");
  old.answer = "답";
  old.evaluation = { score: 1 };
  old.playerPosition.x = 333;
  old.submission.reason = "이전 답안";
  old.submission.actions.official = true;
  const fresh = createRunData(2);
  assert.deepEqual(fresh, {
    scenarioId: 2,
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
  });
  fresh.investigatedObjects.push("smartphone");
  assert.deepEqual(old.investigatedObjects, ["notebook"]);
});
test("최근접 대상 하나만 선택하며 같은 거리는 순서를 유지한다", () => {
  const first = { id: "first", x: 10, y: 0 },
    second = { id: "second", x: -10, y: 0 };
  assert.equal(nearestObject({ x: 0, y: 0 }, [first, second], 20), first);
  assert.equal(nearestObject({ x: -9, y: 0 }, [first, second], 20), second);
  assert.equal(nearestObject({ x: 100, y: 100 }, [first, second], 20), null);
  assert.equal(nearestObject({ x: 0, y: 0 }, [first], 10), first);
});
test("조사·질문은 중복 기록하지 않는다", () => {
  const values = [];
  rememberOnce(values, "q1");
  rememberOnce(values, "q1");
  rememberOnce(values, "q2");
  assert.deepEqual(values, ["q1", "q2"]);
});
