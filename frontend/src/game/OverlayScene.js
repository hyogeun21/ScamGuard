import Phaser from "phaser";
import {
  initDoor,
  doorPanelKey,
  renderDoor,
  saveDoorDraft,
  disposeDoor,
} from "./doorUI";
import { ASSETS, UI } from "./config";
import { getScenario } from "./content";
import { rememberOnce } from "./state";
import {
  getComputerGraph,
  resolveComputerPage,
  followComputerAction,
  computerBack,
} from "./computerContent";

// 메뉴 팝업·메모장·스마트폰·전화기를 같은 생명주기로 관리합니다.
export class OverlayScene extends Phaser.Scene {
  constructor() {
    super("Overlay");
  }
  init(data) {
    this.parentScene = data.parentScene;
    this.type = data.type;
    this.run = null;
    this.doorReason = null;
    this.evalController = null;
    this.evaluationBusy = false;
    this.pendingSubmission = null;
    this.tipInterval = null;
    this.page =
      this.type === "smartphone"
        ? "messages"
        : this.type === "telephone"
          ? "contact"
          : "single";
    if (this.type === "door") this.page = "form";
    this.messageIndex = 0;
    this.questionIndex = 0;
    this.closing = false;
    this.focusFrame = null;
  }
  create() {
    this.run = this.registry.get("runData");
    this.scenario = getScenario(this.run?.scenarioId ?? 1);
    this.computerGraph = getComputerGraph(this.scenario.id);
    this.computerPageId = this.computerGraph.root;
    if (this.type === "door") initDoor(this);
    this.oldFocus = document.activeElement;
    this.add.rectangle(960, 540, 1920, 1080, 0, 0.72).setInteractive();
    this.root = document.createElement("section");
    this.root.className = "sg-window";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "sg-dialog-title");
    this.dom = this.add.dom(960, 540, this.root).setOrigin(0.5);
    // Phaser 기본 렌더러가 CSS grid를 display:block으로 덮어쓰지 않게 합니다.
    this.dom.transformOnly = true;
    this.root.style.display = "grid";
    this.manager = this.input.keyboard.manager;
    this.oldKeyboardEnabled = this.manager.enabled;
    // 캡처된 WASD/E 키와 Ctrl+C/V/A/X가 HTML 편집을 방해하지 않게 합니다.
    this.manager.enabled = false;
    this.keydown = (event) => {
      if (event.key === "Escape" && !event.repeat && !event.isComposing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close();
        return;
      }
      if (event.key === "Tab") {
        const items = [
          ...this.root.querySelectorAll('button,input,textarea,[tabindex="0"]'),
        ];
        const first = items[0],
          last = items.at(-1),
          active = document.activeElement;
        if (!first) return;
        if (
          event.shiftKey &&
          (active === first || !this.root.contains(active))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (active === last || !this.root.contains(active))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", this.keydown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cancelAnimationFrame(this.focusFrame);
      this.saveMemo();
      disposeDoor(this);
      document.removeEventListener("keydown", this.keydown, true);
      this.manager.enabled = this.oldKeyboardEnabled;
      this.dom.destroy();
      this.memoInput = null;
      const parent = this.scene.get(this.parentScene);
      parent?.input?.keyboard?.resetKeys();
      if (this.oldFocus?.isConnected)
        this.oldFocus.focus?.({ preventScroll: true });
    });
    this.render();
  }
  imageButton(key, caption, callback, w = 250, h = 85) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "sg-image-button";
    element.style.width = `${w}px`;
    element.style.height = `${h}px`;
    element.setAttribute("aria-label", caption);
    const fallback = () => {
      const span = document.createElement("span");
      span.className = "sg-fallback";
      span.textContent = key === "investigationClose" ? "×" : caption;
      element.replaceChildren(span);
    };
    if (this.textures.exists(key)) {
      const image = document.createElement("img");
      image.alt = caption;
      image.onerror = fallback;
      image.src = `/assets/${ASSETS[key]}`;
      element.append(image);
    } else fallback();
    element.addEventListener("click", () => {
      if (!this.closing) callback();
    });
    return element;
  }
  caption(value) {
    const element = document.createElement("p");
    element.className = "sg-caption";
    element.textContent = value;
    return element;
  }
  bubble(value, outgoing = false) {
    const element = document.createElement("div");
    element.className = "sg-bubble" + (outgoing ? " sg-outgoing" : "");
    element.textContent = value;
    return element;
  }
  option(value, index, callback) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "sg-option";
    const number = document.createElement("span");
    number.className = "sg-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const content = document.createElement("span");
    content.className = "sg-option-text";
    content.textContent = value;
    element.append(number, content);
    element.addEventListener("click", callback);
    return element;
  }
  go(page) {
    this.page = page;
    this.render();
  }
  back(page) {
    this.footer.append(
      this.imageButton("investigationBack", "뒤로가기", () => this.go(page)),
    );
  }
  record(id) {
    if (this.run) rememberOnce(this.run.requestedQuestions, id);
  }
  render() {
    cancelAnimationFrame(this.focusFrame);
    this.saveMemo();
    saveDoorDraft(this);
    this.doorReason = null;
    this.memoInput = null;
    this.root.replaceChildren();
    const definition = {
      help: ["helpPanel", UI.help],
      exit: ["exitPanel", UI.popup],
      pause: ["pausePanel", UI.popup],
      notebook: ["notebookPanel", UI.notebook],
      smartphone: ["smartphonePanel", UI.investigation],
      telephone: ["telephonePanel", UI.investigation],
      computer: ["computerPanel", UI.computer],
      door: [doorPanelKey(this.page), UI.door],
    }[this.type] ?? [null, UI.popup];
    const [panel, size] = definition;
    this.root.style.width = `${size.w}px`;
    this.root.style.height = `${size.h}px`;
    this.root.style.backgroundImage =
      panel && this.textures.exists(panel)
        ? `url("/assets/${ASSETS[panel]}")`
        : "none";
    const header = document.createElement("header");
    header.className = "sg-header";
    this.title = document.createElement("h2");
    this.title.className = "sg-heading";
    this.title.id = "sg-dialog-title";
    header.append(this.title);
    if (
      ["smartphone", "telephone", "computer"].includes(this.type) ||
      (this.type === "door" && !["waiting", "result"].includes(this.page))
    )
      header.append(
        this.imageButton(
          "investigationClose",
          "조사창 닫기",
          () => this.close(),
          65,
          65,
        ),
      );
    this.content = document.createElement("div");
    this.content.className = "sg-content";
    this.content.tabIndex = 0;
    this.content.setAttribute("aria-label", "조사 내용");
    this.footer = document.createElement("footer");
    this.footer.className = "sg-footer";
    this.root.append(header, this.content, this.footer);
    if (this.type === "smartphone") this.renderSmartphone();
    else if (this.type === "telephone") this.renderTelephone();
    else if (this.type === "notebook") this.renderNotebook();
    else if (this.type === "computer") this.renderComputer();
    else if (this.type === "door") renderDoor(this);
    else this.renderPopup(panel);
    this.content.scrollTop = 0;
    // 내용을 만든 뒤 실제 외곽 크기로 원점을 갱신합니다.
    this.dom.updateSize();
    this.focusFrame = requestAnimationFrame(() => {
      if (!this.root.isConnected) return;
      const target =
        this.memoInput ||
        this.content.querySelector("button") ||
        this.footer.querySelector("button") ||
        header.querySelector("button") ||
        this.content;
      target.focus({ preventScroll: true });
      if (this.memoInput)
        this.memoInput.setSelectionRange(
          this.memoInput.value.length,
          this.memoInput.value.length,
        );
    });
  }
  renderPopup(panel) {
    this.content.classList.add("sg-center");
    if (this.type === "help") {
      this.title.textContent = this.textures.exists(panel) ? "" : "게임방법";
      // 설명까지 포함된 패널 이미지가 있으면 설명 텍스트를 중복 표시하지 않습니다.
      if (!this.textures.exists(panel))
        this.content.append(
          this.bubble(
            "W / A / S / D : 이동\nE : 가장 가까운 오브젝트 하나 조사\nESC : 일시정지 / 열린 창 닫기\n\n메모장에서는 한글 입력과 복사·붙여넣기가 가능합니다.",
          ),
        );
      this.footer.append(
        this.imageButton("helpClose", "닫기", () => this.close()),
      );
    } else if (this.type === "exit") {
      this.title.textContent = this.textures.exists(panel)
        ? ""
        : "게임을 종료하시겠습니까?";
      this.footer.append(
        this.imageButton("exitClose", "창닫기", () => this.close()),
        this.imageButton("exitConfirm", "게임종료하기", () =>
          this.leave("End", true),
        ),
      );
    } else if (this.type === "pause") {
      this.title.textContent = this.textures.exists(panel) ? "" : "일시정지";
      this.footer.append(
        this.imageButton("pauseClose", "창닫기", () => this.close()),
        this.imageButton("pauseMain", "메인화면으로가기", () =>
          this.leave("Main"),
        ),
      );
    } else {
      this.title.textContent = this.type === "computer" ? "컴퓨터" : "문";
      this.content.append(
        this.bubble(
          "세부 조사 흐름은 아직 정해지지 않았습니다.\n현재는 오브젝트 상호작용을 확인하는 임시 화면입니다.",
        ),
      );
      this.footer.append(
        this.imageButton("helpClose", "닫기", () => this.close()),
      );
    }
  }
  renderComputer() {
    const page = resolveComputerPage(this.computerGraph, this.computerPageId);
    this.title.textContent = page.title;
    if (this.run) {
      this.run.computerPages ??= [];
      rememberOnce(this.run.computerPages, this.computerPageId);
    }
    if (page.body) this.content.append(this.bubble(page.body));
    page.actions.forEach((entry, index) => {
      const navigate = () => {
        this.computerPageId = followComputerAction(
          this.computerGraph,
          this.computerPageId,
          index,
        );
        this.render();
      };
      if (entry.buttonKey) {
        this.footer.append(
          this.imageButton(entry.buttonKey, entry.label, navigate, 300, 85),
        );
      } else {
        this.content.append(this.option(entry.label, index, navigate));
      }
    });
    const previous = computerBack(this.computerGraph, this.computerPageId);
    if (previous !== null) {
      const back = this.imageButton("investigationBack", "뒤로가기", () => {
        this.computerPageId = previous;
        this.render();
      });
      this.footer.prepend(back);
    }
  }
  renderNotebook() {
    this.title.textContent = "조사 메모";
    this.content.classList.add("sg-note-content");
    const input = document.createElement("textarea");
    input.className = "sg-note";
    input.setAttribute("aria-label", "조사 메모 입력");
    input.placeholder = "조사한 내용을 자유롭게 기록하세요.";
    input.spellcheck = false;
    input.value = this.run?.memo ?? "";
    input.addEventListener("input", () => {
      if (this.run) this.run.memo = input.value;
    });
    this.memoInput = input;
    this.content.append(input);
    this.footer.append(
      this.imageButton("notebookClose", "닫기", () => this.close()),
    );
  }
  renderSmartphone() {
    const messages = this.scenario.messages,
      message = messages[this.messageIndex];
    if (this.page === "messages") {
      this.title.textContent = "메시지";
      messages.forEach((item, index) =>
        this.content.append(
          this.option(item.title, index, () => {
            this.messageIndex = index;
            this.go("message");
          }),
        ),
      );
    } else if (this.page === "message") {
      this.title.textContent = message.title;
      this.content.append(
        this.caption(`발신자: ${message.sender}`),
        this.bubble(message.body),
      );
      this.back("messages");
      this.footer.append(
        this.imageButton("additionalQuestion", "추가질문", () =>
          this.go("messageQuestions"),
        ),
      );
    } else if (this.page === "messageQuestions") {
      this.title.textContent = "추가질문";
      message.questions.forEach((item, index) =>
        this.content.append(
          this.option(item.title, index, () => {
            this.questionIndex = index;
            this.record(`smartphone:${message.id}:${item.id}`);
            this.go("messageAnswer");
          }),
        ),
      );
      this.back("message");
    } else {
      const question = message.questions[this.questionIndex];
      this.title.textContent = "질문과 답변";
      this.content.append(
        this.bubble(question.title, true),
        this.caption(message.sender),
        this.bubble(question.answer),
      );
      this.back("messageQuestions");
    }
  }
  renderTelephone() {
    if (this.page === "contact") {
      this.title.textContent = "공식 연락처";
      this.content.append(
        this.bubble(
          `${this.scenario.contact.name}\n${this.scenario.contact.number}`,
        ),
      );
      this.footer.append(
        this.imageButton("telephoneCall", "전화걸기", () =>
          this.go("callQuestions"),
        ),
      );
    } else if (this.page === "callQuestions") {
      this.title.textContent = "통화 중 · 문의 내용";
      this.scenario.callQuestions.forEach((item, index) =>
        this.content.append(
          this.option(item.title, index, () => {
            this.questionIndex = index;
            this.record(`telephone:${item.id}`);
            this.go("callAnswer");
          }),
        ),
      );
      this.endCallButton();
    } else {
      const question = this.scenario.callQuestions[this.questionIndex];
      this.title.textContent = "통화 중 · 답변";
      this.content.append(
        this.bubble(question.title, true),
        this.caption(this.scenario.contact.name),
        this.bubble(question.answer),
      );
      this.back("callQuestions");
      this.endCallButton();
    }
  }
  endCallButton() {
    this.footer.append(
      this.imageButton("telephoneEnd", "통화종료", () => this.go("contact")),
    );
  }
  saveMemo() {
    if (this.memoInput && this.run) this.run.memo = this.memoInput.value;
  }
  close() {
    if (this.closing || this.evaluationBusy) return;
    this.closing = true;
    this.saveMemo();
    saveDoorDraft(this);
    // stop의 정리 작업에서 키보드를 복구한 다음 부모를 재개합니다.
    this.scene.stop();
    this.scene.resume(this.parentScene);
  }
  leave(target, endRun = false) {
    if (this.closing || this.evaluationBusy) return;
    this.closing = true;
    this.saveMemo();
    saveDoorDraft(this);
    const parent = this.scene.get(this.parentScene);
    parent.scene.stop();
    if (endRun) this.registry.remove("runData");
    this.scene.start(target);
  }
}
