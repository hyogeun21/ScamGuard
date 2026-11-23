import test from "node:test";
import assert from "node:assert/strict";
import { createRunData } from "../src/game/state.js";
import {
  validateDraft,
  createSubmission,
  responseActions,
  validateEvaluation,
  createEvaluationClient,
} from "../src/game/evaluation.js";
function answer() {
  const run = createRunData(2);
  run.submission = {
    verdict: "scam",
    reason: "조사한 기록에서 서로 다른 안내를 확인했습니다.",
    actions: { official: true },
  };
  return run;
}
test("판단 미선택과 빈 근거를 막는다", () => {
  assert.ok(validateDraft({ verdict: null, reason: "내용" }));
  assert.ok(validateDraft({ verdict: "scam", reason: "  " }));
  assert.equal(validateDraft(answer().submission), null);
});
test("체크/미체크 행동과 제출 당시 답안을 독립적으로 저장한다", () => {
  const run = answer(),
    payload = createSubmission(run);
  assert.equal(payload.responseActions.length, responseActions(2).length);
  assert.equal(
    payload.responseActions.find((a) => a.id === "official").done,
    true,
  );
  assert.equal(
    payload.responseActions.find((a) => a.id === "privacy").done,
    false,
  );
  run.submission.reason = "수정";
  run.investigatedObjects.push("door");
  assert.notEqual(payload.reason, run.submission.reason);
  assert.deepEqual(payload.investigation.objects, []);
});
test("테스트 평가의 일시 오류 후 같은 답안을 재시도할 수 있다", async () => {
  const client = createEvaluationClient({ demoFailOnce: true, delayMs: 1 }),
    payload = createSubmission(answer());
  await assert.rejects(client.evaluate(payload), /일시 오류/);
  const result = await client.evaluate(payload);
  assert.equal(result.isDemo, true);
  assert.ok(result.score >= 0 && result.score <= 100);
});
test("잘못된 서버 결과와 HTTP 오류를 차단한다", async () => {
  assert.throws(() => validateEvaluation({ score: 999 }));
  assert.throws(() => validateEvaluation({ score: 50, strengths: "문자열" }));
  const client = createEvaluationClient({
    endpoint: "/api/evaluate",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  await assert.rejects(client.evaluate(createSubmission(answer())), /503/);
});
test("실제 API 계약 형식의 JSON 요청과 정상 결과를 검증한다", async () => {
  let captured;
  const client = createEvaluationClient({
    endpoint: "/api/evaluate",
    fetchImpl: async (url, options) => {
      captured = { url, ...options };
      return {
        ok: true,
        json: async () => ({
          score: 80,
          strengths: ["좋은 점"],
          improvements: ["개선"],
          preventionTips: ["팁"],
        }),
      };
    },
  });
  const result = await client.evaluate(createSubmission(answer()));
  assert.equal(result.isDemo, false);
  assert.equal(captured.method, "POST");
  assert.equal(JSON.parse(captured.body).scenarioId, 2);
});
test("긴 요청은 시간초과 처리하고 취소 신호도 지원한다", async () => {
  const client = createEvaluationClient({
    endpoint: "/api/evaluate",
    timeoutMs: 5,
    fetchImpl: async (_, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(new DOMException("취소", "AbortError")),
          { once: true },
        );
      }),
  });
  await assert.rejects(client.evaluate(createSubmission(answer())), /초과/);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    createEvaluationClient({ delayMs: 10 }).evaluate(
      createSubmission(answer()),
      { signal: abort.signal },
    ),
    { name: "AbortError" },
  );
});
