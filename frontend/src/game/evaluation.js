// API 키를 이 프런트엔드에 넣지 마세요. 실제 AI 호출은 별도 백엔드에서 처리합니다.
export const PREVENTION_TIPS = [
  "급하게 결정하라는 요청을 받으면 잠시 멈추고 조사한 내용을 다시 비교해보세요.",
  "메시지로 받은 연락처와 별도로 확인한 공식 연락처가 같은지 살펴보세요.",
  "판단근거에는 어떤 기록에서 무엇을 확인했는지 구체적으로 적어보세요.",
  "개인정보나 돈을 요구하는 단계가 언제 등장했는지 정리해보세요.",
];
const common = [
  ["official", "공식 연락처로 사실을 확인했다"],
  ["compare", "서로 다른 자료의 내용을 비교했다"],
  ["privacy", "개인정보 제공 요구를 확인했다"],
  ["payment", "입금·결제 요구와 조건을 확인했다"],
];
export function responseActions(scenarioId) {
  const specific = {
    1: ["hiring", "채용 절차와 담당자 정보를 비교했다"],
    2: ["work", "업무 조건과 정산·출금 조건을 확인했다"],
    3: ["investment", "투자앱과 공식앱 정보를 비교했다"],
    4: ["lodging", "숙소 검색결과와 예약·결제 정보를 비교했다"],
  };
  return [...common, specific[scenarioId] ?? specific[1]].map(
    ([id, label]) => ({ id, label }),
  );
}
export function validateDraft(draft) {
  if (!["normal", "scam"].includes(draft.verdict))
    return "정상 또는 사기 중 하나를 선택해주세요.";
  if (!draft.reason.trim()) return "판단근거를 입력해주세요.";
  if (draft.reason.length > 10000)
    return "판단근거는 10,000자 이내로 입력해주세요.";
  return null;
}
export function createSubmission(run) {
  const error = validateDraft(run.submission);
  if (error) throw new Error(error);
  return {
    schemaVersion: 1,
    requestId:
      globalThis.crypto?.randomUUID?.() ??
      `request-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    scenarioId: run.scenarioId,
    verdict: run.submission.verdict,
    reason: run.submission.reason.trim(),
    responseActions: responseActions(run.scenarioId).map((item) => ({
      id: item.id,
      done: run.submission.actions[item.id] === true,
    })),
    investigation: {
      memo: run.memo,
      objects: [...run.investigatedObjects],
      questions: [...run.requestedQuestions],
      computerPages: [...run.computerPages],
    },
  };
}
export function validateEvaluation(value) {
  if (
    !value ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 100
  )
    throw new Error("평가 응답의 점수가 올바르지 않습니다.");
  for (const key of ["strengths", "improvements", "preventionTips"])
    if (
      !Array.isArray(value[key]) ||
      !value[key].every((v) => typeof v === "string")
    )
      throw new Error("평가 응답 형식이 올바르지 않습니다.");
  return {
    score: value.score,
    strengths: [...value.strengths],
    improvements: [...value.improvements],
    preventionTips: [...value.preventionTips],
  };
}
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("취소되었습니다.", "AbortError"));
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("취소되었습니다.", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}
export function demoEvaluation(payload) {
  const done = payload.responseActions.filter((a) => a.done).length;
  // 입력/확인 동작 검증용 규칙입니다. 정답 또는 실제 대응의 적절성을 채점하지 않습니다.
  return {
    score:
      20 +
      Math.min(40, Math.floor(payload.reason.length / 2)) +
      Math.round((40 * done) / payload.responseActions.length),
    strengths: [
      "판단과 근거를 작성해 제출했습니다.",
      `대응행동 ${done}개를 했다고 표시했습니다.`,
    ],
    improvements: [
      "테스트용 규칙 점수입니다. 실제 판단의 정답 여부와 근거의 타당성을 평가한 결과가 아닙니다.",
    ],
    preventionTips: ["본인의 판단근거를 조사한 기록과 다시 비교해보세요."],
  };
}
export function createEvaluationClient({
  endpoint = "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 20000,
  delayMs = 1400,
  demoFailOnce = false,
} = {}) {
  let failPending = demoFailOnce;
  return {
    isDemo: !endpoint,
    async evaluate(payload, { signal } = {}) {
      if (!endpoint) {
        await delay(delayMs, signal);
        if (failPending) {
          failPending = false;
          throw new Error(
            "테스트용 일시 오류입니다. 다시 판단하기를 눌러주세요.",
          );
        }
        return { ...validateEvaluation(demoEvaluation(payload)), isDemo: true };
      }
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort();
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(`평가 서버 응답 오류 (${response.status})`);
        return { ...validateEvaluation(await response.json()), isDemo: false };
      } catch (error) {
        if (timedOut)
          throw new Error("평가 시간이 초과되었습니다. 다시 시도해주세요.");
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
