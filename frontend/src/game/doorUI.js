import {
  createEvaluationClient,
  createSubmission,
  validateDraft,
  responseActions,
  PREVENTION_TIPS,
} from "./evaluation";
const env = import.meta.env ?? {};
export function initDoor(scene) {
  scene.evaluationBusy = false;
  scene.doorError = "";
  scene.evalClient = createEvaluationClient({
    endpoint: env.VITE_EVALUATION_URL ?? "",
    demoFailOnce: env.VITE_DEMO_FAIL_ONCE === "true",
  });
}
export function doorPanelKey(page) {
  return (
    {
      confirm: "submitConfirmPanel",
      waiting: "evaluationWaitingPanel",
      error: "evaluationWaitingPanel",
      result: "evaluationResultPanel",
    }[page] ?? "doorPanel"
  );
}
export function saveDoorDraft(s) {
  if (s.doorReason && s.run) {
    s.run.submission.reason = s.doorReason.value;
    s.run.answer = s.doorReason.value;
  }
}
export function disposeDoor(s) {
  saveDoorDraft(s);
  s.evalController?.abort();
  clearInterval(s.tipInterval);
  s.doorReason = null;
}
function paragraph(value, className = "sg-message") {
  const e = document.createElement("p");
  e.className = className;
  e.textContent = value;
  return e;
}
function modeNotice(s) {
  return s.caption(
    s.evalClient.isDemo
      ? "테스트 평가 모드 · 실제 AI 평가가 아닙니다."
      : "AI 평가 · 제출한 판단과 근거를 평가 서버로 전송합니다.",
  );
}
function section(title) {
  const e = document.createElement("h3");
  e.className = "sg-section-title";
  e.textContent = title;
  return e;
}
function backToForm(s) {
  s.doorError = "";
  s.page = "form";
  s.render();
}
export function renderDoor(s) {
  clearInterval(s.tipInterval);
  s.doorReason = null;
  if (s.page === "form") renderForm(s);
  else if (s.page === "confirm") renderConfirm(s);
  else if (s.page === "waiting" || s.page === "error") renderWaiting(s);
  else if (s.page === "result") renderResult(s);
}
function doorAction(s, label, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sg-door-action";
  button.textContent = label;
  button.addEventListener("click", () => {
    if (!s.closing && !s.evaluationBusy) callback();
  });
  return button;
}
function renderForm(s) {
  s.title.textContent = "최종 판단 · 조사 결과 제출";
  s.content.append(modeNotice(s), section("1. 정상 / 사기 판단"));
  const radios = document.createElement("div");
  radios.className = "sg-verdicts";
  radios.setAttribute("role", "radiogroup");
  radios.setAttribute("aria-label", "정상 또는 사기 판단");
  const draft = s.run.submission;
  for (const [value, label, key] of [
    ["normal", "정상", "verdictNormal"],
    ["scam", "사기", "verdictScam"],
  ]) {
    const b = doorAction(s, label, () => {
      draft.verdict = value;
      for (const item of radios.querySelectorAll("button"))
        item.setAttribute("aria-checked", String(item.dataset.value === value));
    });
    b.setAttribute("role", "radio");
    b.dataset.value = value;
    b.setAttribute("aria-checked", String(draft.verdict === value));
    radios.append(b);
  }
  s.content.append(radios, section("2. 판단근거"));
  const input = document.createElement("textarea");
  input.className = "sg-reason";
  input.value = draft.reason;
  input.maxLength = 10000;
  input.setAttribute("aria-label", "판단근거");
  input.placeholder =
    "조사한 기록과 확인한 사실을 근거로 판단한 이유를 적어주세요.";
  input.addEventListener("input", () => {
    draft.reason = input.value;
    s.run.answer = input.value;
  });
  s.doorReason = input;
  s.content.append(
    input,
    s.caption("한글·여러 줄 입력·복사/붙여넣기 가능 · 최대 10,000자"),
    section("3. 대응행동 · 오른쪽 네모에 체크"),
  );
  for (const item of responseActions(s.run.scenarioId)) {
    const label = document.createElement("label");
    label.className = "sg-response-row";
    const text = document.createElement("span");
    text.textContent = item.label;
    const status = document.createElement("span");
    status.className = "sg-check-status";
    status.textContent = draft.actions[item.id] ? "했다" : "안 했다";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = draft.actions[item.id] === true;
    checkbox.setAttribute("aria-label", `${item.label} · 했다`);
    checkbox.addEventListener("change", () => {
      draft.actions[item.id] = checkbox.checked;
      status.textContent = checkbox.checked ? "했다" : "안 했다";
    });
    label.append(text, status, checkbox);
    s.content.append(label);
  }
  const error = document.createElement("p");
  error.className = "sg-error";
  error.setAttribute("role", "alert");
  error.textContent = s.doorError;
  s.content.append(error);
  s.footer.append(
    doorAction(s, "최종제출", () => {
      saveDoorDraft(s);
      const errorMessage = validateDraft(draft);
      if (errorMessage) {
        s.doorError = errorMessage;
        error.textContent = errorMessage;
        error.scrollIntoView({ block: "nearest" });
        return;
      }
      s.pendingSubmission = createSubmission(s.run);
      s.doorError = "";
      s.page = "confirm";
      s.render();
    }),
  );
}
function renderConfirm(s) {
  s.title.textContent = "최종 제출하시겠습니까?";
  s.content.append(modeNotice(s));
  s.content.append(
    s.bubble(
      `선택한 판단: ${s.pendingSubmission.verdict === "scam" ? "사기" : "정상"}\n\n판단근거:\n${s.pendingSubmission.reason}\n\n했다로 체크한 행동: ${s.pendingSubmission.responseActions.filter((a) => a.done).length}개`,
    ),
  );
  s.content.append(
    s.caption(
      "확인을 누르면 이 답안을 평가합니다. 취소해도 입력 내용은 유지됩니다.",
    ),
  );
  s.footer.append(
    doorAction(s, "뒤로가기", () => backToForm(s)),
    doorAction(s, "확인", () => startEvaluation(s)),
  );
}
async function startEvaluation(s) {
  if (s.evaluationBusy || s.closing) return;
  s.evaluationBusy = true;
  s.doorError = "";
  s.run.evaluation = null;
  s.run.lastSubmission = s.pendingSubmission;
  s.evalController = new AbortController();
  const requestController = s.evalController;
  s.page = "waiting";
  s.render();
  try {
    const result = await s.evalClient.evaluate(s.pendingSubmission, {
      signal: requestController.signal,
    });
    if (
      s.evalController !== requestController ||
      requestController.signal.aborted ||
      s.closing ||
      !s.root.isConnected
    )
      return;
    s.run.evaluation = result;
    s.evaluationBusy = false;
    s.page = "result";
    s.render();
  } catch (error) {
    if (
      s.evalController !== requestController ||
      requestController.signal.aborted ||
      s.closing ||
      !s.root.isConnected
    )
      return;
    s.evaluationBusy = false;
    s.doorError =
      error.name === "AbortError"
        ? "평가 요청이 취소되었습니다. 다시 시도해주세요."
        : error.message || "평가에 실패했습니다.";
    s.page = "error";
    s.render();
  }
}
function renderWaiting(s) {
  const failed = s.page === "error";
  s.title.textContent = failed
    ? "평가를 완료하지 못했습니다"
    : "판단 중입니다…";
  s.content.setAttribute("role", "status");
  s.content.setAttribute("aria-live", "polite");
  s.content.append(modeNotice(s));
  s.content.append(
    paragraph(
      failed
        ? s.doorError
        : "제출한 판단과 근거를 확인하고 있습니다. 잠시 기다려주세요.",
      failed ? "sg-error" : "sg-message",
    ),
  );
  const tip = s.bubble(PREVENTION_TIPS[0]);
  s.content.append(section("기다리는 동안 · 조사 팁"), tip);
  let index = 0;
  s.tipInterval = setInterval(() => {
    if (tip.isConnected)
      tip.textContent = PREVENTION_TIPS[++index % PREVENTION_TIPS.length];
  }, 4000);
  if (failed)
    s.footer.append(
      s.imageButton(
        "investigationBack",
        "입력창으로 돌아가기",
        () => backToForm(s),
        300,
      ),
      s.imageButton("evaluationRetry", "다시 판단하기", () =>
        startEvaluation(s),
      ),
    );
  else
    s.content.append(
      s.caption(
        "중복 제출을 막기 위해 평가 중에는 창 닫기와 뒤로가기가 잠겨 있습니다.",
      ),
    );
}
function renderResult(s) {
  const result = s.run.evaluation;
  s.title.textContent = result.isDemo ? "테스트 평가 결과" : "AI 평가 결과";
  s.content.append(
    modeNotice(s),
    paragraph(`${result.score} / 100점`, "sg-score"),
  );
  for (const [title, key] of [
    ["잘한 점", "strengths"],
    ["부족한 점 · 개선할 점", "improvements"],
    ["예방 팁", "preventionTips"],
  ]) {
    s.content.append(section(title));
    if (!result[key].length)
      s.content.append(s.caption("별도 피드백이 없습니다."));
    for (const value of result[key]) s.content.append(s.bubble(value));
  }
  s.footer.append(
    s.imageButton("retryGame", "다시도전하기", () => s.close()),
    s.imageButton(
      "pauseMain",
      "메인메뉴로 돌아가기",
      () => s.leave("Main"),
      300,
    ),
  );
}
