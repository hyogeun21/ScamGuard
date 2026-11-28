import layout from "./smartphone-layout.json" with { type: "json" };
import { smartphoneData, messageThread, askMessageQuestion, callChoices, askCallQuestion } from "./smartphoneState";
import { rememberOnce } from "./state";
function el(tag, cls, text) { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function button(s, text, callback, cls) {
  const b = el("button", cls, text); b.type = "button";
  b.addEventListener("click", () => { if (!s.closing) callback(); }); return b;
}
function place(e, r) { Object.assign(e.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` }); }
function conversation(s, container, turns, initial) {
  if (initial) { const b = s.bubble(initial); b.classList.add("sg-smart-bubble"); container.append(b); }
  for (const turn of turns) { const b = s.bubble(turn.text, turn.role === "outgoing"); b.classList.add("sg-smart-bubble"); container.append(b); }
}
export function renderSmartphonePanel(s) {
  const data = smartphoneData(s.run), mode = s.phoneMode ?? "home";
  Object.assign(s.root.style, { display: "block", width: `${layout.width}px`, height: `${layout.height}px`, padding: "0", background: "transparent", borderRadius: "0" });
  s.dom.setPosition(layout.center.x, layout.center.y);
  s.title = el("h2", "sg-smart-sr", "스마트폰 조사"); s.title.id = "sg-dialog-title"; s.root.append(s.title);
  const phone = el("section", "sg-smart-device"); phone.setAttribute("aria-label", "스마트폰 화면"); place(phone, layout.phone);
  const header = el("header", "sg-smart-device-header");
  if (mode !== "home") {
    const back = button(s, "‹", () => { s.phoneMode = "home"; s.phoneDetail = null; s.render(); }, "sg-smart-home-back");
    back.setAttribute("aria-label", "스마트폰 홈으로"); header.append(back);
  }
  header.append(el("h3", "sg-smart-device-title", mode === "messages" ? "메시지" : mode === "phone" ? "전화" : "스마트폰"));
  const close = button(s, "×", () => s.close(), "sg-smart-close"); close.setAttribute("aria-label", "스마트폰 닫기"); header.append(close); phone.append(header);
  if (mode === "home") {
    const apps = el("div", "sg-smart-apps");
    for (const [id, label, icon] of [["phone", "전화", "smartphone-phone-icon.svg"], ["messages", "메시지", "smartphone-message-icon.svg"]]) {
      const app = button(s, "", () => { s.phoneMode = id; s.phoneDetail = null; if (id === "phone") rememberOnce(s.run.investigatedObjects, "telephone"); s.render(); }, "sg-smart-app");
      const image = el("img", "sg-smart-app-icon"); image.src = `/assets/${icon}`; image.alt = "";
      app.append(image, el("span", "", label)); app.setAttribute("aria-label", label); apps.append(app);
    }
    phone.append(apps);
  } else if (mode === "messages") {
    const list = el("div", "sg-smart-list"); list.setAttribute("aria-label", "수신 메시지 목록");
    for (const message of s.scenario.messages) {
      const item = button(s, "", () => { s.phoneDetail = { kind: "message", id: message.id }; s.render(); }, "sg-smart-message-item");
      item.append(el("span", "sg-smart-message-label", message.title)); item.setAttribute("aria-label", message.title);
      item.setAttribute("aria-pressed", String(s.phoneDetail?.kind === "message" && s.phoneDetail.id === message.id)); list.append(item);
    }
    phone.append(list);
  } else {
    const contact = el("div", "sg-smart-contact");
    contact.append(el("strong", "", s.scenario.contact.name), el("span", "", s.scenario.contact.number)); phone.append(contact);
    const list = el("div", "sg-smart-list sg-smart-call-list"); list.setAttribute("aria-label", "전화 질문 목록");
    list.append(el("p", "sg-smart-call-label", data.call.turns.length ? "추가로 물어볼 내용을 선택하세요." : "먼저 물어볼 내용을 선택하세요."));
    for (const { question, path } of callChoices(s.run, s.scenario)) {
      const id = path.join("/");
      const item = button(s, question.title, () => {
        askCallQuestion(s.run, s.scenario, path); s.record(`telephone:${id}`);
        s.phoneDetail = { kind: "call" }; s.render();
      }, "sg-smart-call-question");
      item.setAttribute("aria-pressed", String(data.call.lastPath.join("/") === id));
      if (data.call.asked.includes(id)) item.title = "이미 확인한 질문 · 대화 다시 보기";
      list.append(item);
    }
    phone.append(list);
    const controls = el("div", "sg-smart-call-controls");
    controls.append(button(s, "처음 질문", () => { data.call.lastPath = []; s.render(); }, "sg-smart-small-action"));
    controls.append(button(s, "통화종료", () => { s.phoneMode = "home"; s.phoneDetail = null; s.render(); }, "sg-smart-small-action")); phone.append(controls);
  }
  s.root.append(phone);
  let thread;
  if (s.phoneDetail) {
    const detail = el("section", "sg-smart-detail"); place(detail, layout.detail); detail.dataset.memoScope = "";
    const detailClose = button(s, "×", () => { s.phoneDetail = null; s.render(); }, "sg-smart-close sg-smart-detail-close");
    detailClose.setAttribute("aria-label", "세부사항 닫기"); detail.append(detailClose);
    if (s.phoneDetail.kind === "message") {
      detail.classList.add("sg-smart-message-detail");
      const message = s.scenario.messages.find(m => m.id === s.phoneDetail.id);
      const history = messageThread(s.run, message.id);
      const company = el("div", "sg-smart-company");
      company.append(el("h3", "", message.companyName ?? s.scenario.companyName ?? "회사 정보 미입력"), el("p", "", message.companyDetails ?? s.scenario.companyDetails ?? message.title));
      detail.append(company, el("div", "sg-smart-sender", message.senderDetails ?? message.sender));
      thread = el("div", "sg-content sg-smart-thread sg-smart-message-thread");
      thread.setAttribute("aria-label", "메시지 대화 내용"); conversation(s, thread, history.turns, message.body); detail.append(thread);
      const questions = el("section", "sg-smart-message-questions"); questions.setAttribute("aria-label", "메시지 추가질문");
      questions.append(el("h4", "", "추가질문"));
      const grid = el("div", "sg-smart-question-grid");
      for (const question of message.questions ?? []) {
        const choice = button(s, question.title, () => {
          askMessageQuestion(s.run, message, question.id); s.record(`smartphone:${message.id}:${question.id}`); s.render();
        }, "sg-smart-route");
        choice.disabled = history.asked.includes(question.id); choice.title = question.title; grid.append(choice);
      }
      if (!(message.questions ?? []).length) grid.append(el("p", "", "등록된 추가질문이 없습니다."));
      questions.append(grid); detail.append(questions);
    } else {
      detail.classList.add("sg-smart-call-detail");
      detail.append(el("h3", "sg-smart-call-name", s.scenario.contact.name), el("div", "sg-smart-call-number", s.scenario.contact.number));
      thread = el("div", "sg-content sg-smart-thread sg-smart-call-thread");
      thread.setAttribute("aria-label", "전화 대화 내용"); conversation(s, thread, data.call.turns); detail.append(thread);
    }
    thread.tabIndex = 0; s.content = thread; s.root.append(detail);
  } else s.content = phone;
  s.dom.updateSize();
  s.focusFrame = requestAnimationFrame(() => {
    if (!s.root.isConnected) return;
    if (thread) thread.scrollTop = thread.scrollHeight;
    (s.root.querySelector('.sg-smart-app') ?? s.root.querySelector('.sg-smart-list button[aria-pressed="true"]') ?? s.root.querySelector('.sg-smart-list button') ?? close).focus({ preventScroll: true });
  });
}
