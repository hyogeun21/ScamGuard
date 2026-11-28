import { renderSmartphonePanel } from "./smartphoneUI";
import { renderComputerPanel } from "./computerUI";
import { getGameAudio } from "./gameAudio";
import pauseLayout from "./pause-layout.json";
import { installSelectionMemo } from "./selectionMemo";
import helpLayout from "./help-layout.json";
import exitLayout from "./exit-layout.json";
import Phaser from "phaser";
import {
  initDoor,
  doorPanelKey,
  renderDoor,
  saveDoorDraft,
  disposeDoor,
} from "./doorUI";
import { ASSETS, UI, ROOM } from "./config";
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
    this.phoneMode = this.type === "telephone" ? "phone" : "home";
    this.phoneDetail = null;
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
    this.computerCategoryId = null;
    this.computerDetailMode = "detail";
    this.computerQuestionId = null;
    if (this.type === "door") initDoor(this);
    this.oldFocus = document.activeElement;
    this.add.rectangle(960, 540, 1920, 1080, 0, this.type === "exit" ? exitLayout.scenes["exit-confirm"].backdrop.alpha : this.type === "help" ? helpLayout.backdrop.alpha : 0.72).setInteractive();
    this.root = document.createElement("section");
    this.root.className = "sg-window";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "sg-dialog-title");
    this.dom = this.add.dom(960, 540, this.root).setOrigin(0.5);
    // Phaser 기본 렌더러가 CSS grid를 display:block으로 덮어쓰지 않게 합니다.
    this.dom.transformOnly = true;
    this.root.style.display = "grid";
    this.audioClick = (event) => {
      const control = event.target.closest?.('button,input[type="checkbox"]');
      if (control && this.root.contains(control) && !control.disabled && !this.closing && !this.evaluationBusy)
        getGameAudio(this.game).interact(this.type);
    };
    this.root.addEventListener("click", this.audioClick, true);
    this.manager = this.input.keyboard.manager;
    this.oldKeyboardEnabled = this.manager.enabled;
    // 캡처된 WASD/E 키와 Ctrl+C/V/A/X가 HTML 편집을 방해하지 않게 합니다.
    this.manager.enabled = false;
    this.keydown = (event) => {
      if (event.key === "Escape" && !event.repeat && !event.isComposing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!this.evaluationBusy) getGameAudio(this.game).interact("button");
        this.close();
        return;
      }
      if (event.key === "Tab") {
        this.root.classList.add("sg-keyboard-navigation");
        const items = [
          ...this.root.querySelectorAll('button,input,textarea,[tabindex="0"]'),
        ].filter(item => !item.disabled && item.getClientRects().length > 0);
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
    this.pointerFocus = () => this.root.classList.remove("sg-keyboard-navigation");
    this.root.addEventListener("pointerdown", this.pointerFocus, true);
    document.addEventListener("keydown", this.keydown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cancelAnimationFrame(this.focusFrame);
      this.saveMemo();
      disposeDoor(this);
      document.removeEventListener("keydown", this.keydown, true);
      this.root.removeEventListener("click", this.audioClick, true);
      this.root.removeEventListener("pointerdown", this.pointerFocus, true);
      this.manager.enabled = this.oldKeyboardEnabled;
      this.dom.destroy();
      this.memoInput = null;
      const parent = this.scene.get(this.parentScene);
      parent?.input?.keyboard?.resetKeys();
      if (this.oldFocus?.isConnected)
        this.oldFocus.focus?.({ preventScroll: true });
    });
    this.render();
    this.selectionMemo = installSelectionMemo(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.selectionMemo?.dispose();
      this.selectionMemo = null;
    });
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
    this.root.classList.remove("sg-keyboard-navigation");
    this.selectionMemo?.reset();
    cancelAnimationFrame(this.focusFrame);
    this.saveMemo();
    saveDoorDraft(this);
    this.doorReason = null;
    this.memoInput = null;
    this.root.replaceChildren();
    this.root.classList.toggle("sg-notebook-window", this.type === "notebook");
    this.root.classList.toggle("sg-door-window", this.type === "door");
    this.root.classList.toggle("sg-computer-window", this.type === "computer");
    this.root.classList.toggle("sg-smartphone-window", ["smartphone", "telephone"].includes(this.type));
    if (["smartphone", "telephone"].includes(this.type)) {
      renderSmartphonePanel(this);
      return;
    }
    if (this.type === "computer") {
      renderComputerPanel(this);
      return;
    }
    if (this.type === "pause") {
      this.renderPausePanel();
      return;
    }
    if (this.type === "help") {
      this.renderHelpPanel();
      return;
    }
    if (this.type === "exit") {
      this.renderExitConfirmation();
      return;
    }
    const definition = {
      help: ["helpPanel", UI.help],
      exit: ["exitPanel", UI.popup],
      pause: ["pausePanel", UI.popup],
      notebook: ["notebookPanel", UI.notebook],
      smartphone: ["smartphonePanel", UI.investigation],
      telephone: ["telephonePanel", UI.investigation],
      computer: ["computerPanel", UI.computer],
      door: ["doorPanel", UI.door],
    }[this.type] ?? [null, UI.popup];
    const [panel, size] = definition;
    if (["notebook", "door"].includes(this.type)) this.dom.setPosition(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h / 2);
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
          this.type === "door" ? "doorClose" : "investigationClose",
          "조사창 닫기",
          () => this.close(),
          this.type === "door" ? 44 : 65,
          this.type === "door" ? 44 : 65,
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
  renderPausePanel() {
    const { panel, close, main } = pauseLayout;
    Object.assign(this.root.style, {
      display: "block", padding: "0", width: `${panel.width}px`, height: `${panel.height}px`,
      backgroundColor: "#151f49", borderRadius: "16px",
      backgroundImage: this.textures.exists("pausePanel") ? `url("/assets/${ASSETS.pausePanel}")` : "none",
    });
    this.dom.setPosition(panel.x + panel.width / 2, panel.y + panel.height / 2);
    const title = document.createElement("h2");
    title.id = "sg-dialog-title";
    title.textContent = "일시정지";
    title.style.cssText = this.textures.exists("pausePanel")
      ? "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);margin:0"
      : "margin:0;text-align:center;color:white;font-size:28px";
    this.root.append(title);
    const hit = close.hitArea;
    const closeButton = this.imageButton("pauseClose", "일시정지 닫기", () => this.close(), hit.width, hit.height);
    Object.assign(closeButton.style, {
      position: "absolute", left: `${hit.x - panel.x}px`, top: `${hit.y - panel.y}px`,
      background: "transparent", padding: "0", border: "0",
    });
    const image = closeButton.querySelector("img");
    if (image) Object.assign(image.style, {
      position: "absolute", left: `${close.x - hit.x}px`, top: `${close.y - hit.y}px`,
      width: `${close.width}px`, height: `${close.height}px`,
    });
    const mainButton = this.imageButton("pauseMain", "메인메뉴로", () => this.leave("Main"), main.width, main.height);
    Object.assign(mainButton.style, { position: "absolute", left: `${main.x - panel.x}px`, top: `${main.y - panel.y}px` });
    this.root.append(closeButton, mainButton);
    this.dom.updateSize();
    this.focusFrame = requestAnimationFrame(() => {
      if (this.root.isConnected) closeButton.focus({ preventScroll: true });
    });
  }
  renderHelpPanel() {
    const panel = helpLayout.assets["help-panel.png"];
    const icon = helpLayout.assets["help-close.png"];
    const hit = icon.hitArea;
    Object.assign(this.root.style, {
      display: "block", padding: "0", width: `${panel.width}px`, height: `${panel.height}px`,
      backgroundColor: "transparent",
      backgroundImage: this.textures.exists("helpPanel") ? `url("/assets/${ASSETS.helpPanel}")` : "none",
    });
    this.dom.setPosition(panel.x + panel.width / 2, panel.y + panel.height / 2);
    const title = document.createElement("h2");
    title.id = "sg-dialog-title";
    title.textContent = "게임 방법";
    title.style.cssText = this.textures.exists("helpPanel")
      ? "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);margin:0"
      : "color:white;text-align:center";
    this.root.append(title);
    const close = this.imageButton("helpClose", "게임방법 닫기", () => this.close(), hit.width, hit.height);
    Object.assign(close.style, {
      position: "absolute", left: `${hit.x - panel.x}px`, top: `${hit.y - panel.y}px`,
      padding: "0", background: "transparent", border: "0",
    });
    const image = close.querySelector("img");
    if (image) Object.assign(image.style, {
      position: "absolute", left: `${icon.x - hit.x}px`, top: `${icon.y - hit.y}px`,
      width: `${icon.width}px`, height: `${icon.height}px`, maxWidth: "none", maxHeight: "none",
    });
    this.root.append(close);
    this.dom.updateSize();
    this.focusFrame = requestAnimationFrame(() => {
      if (this.root.isConnected) close.focus({ preventScroll: true });
    });
  }
  renderExitConfirmation() {
    const assets = exitLayout.scenes["exit-confirm"].assets;
    const panel = assets["exit-panel.png"];
    Object.assign(this.root.style, {
      display: "block", padding: "0", width: `${panel.width}px`,
      height: `${panel.height}px`, backgroundColor: "transparent",
      backgroundImage: this.textures.exists("exitPanel") ? `url("/assets/${ASSETS.exitPanel}")` : "none",
    });
    this.dom.setPosition(panel.x + panel.width / 2, panel.y + panel.height / 2);
    const title = document.createElement("h2");
    title.id = "sg-dialog-title";
    title.textContent = "게임을 종료하시겠습니까?";
    title.style.cssText = this.textures.exists("exitPanel")
      ? "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);margin:0"
      : "position:absolute;top:220px;width:100%;text-align:center;color:white";
    this.root.append(title);
    const buttons = [
      ["exit-close.png", "exitClose", "뒤로가기", () => this.close()],
      ["exit-confirm.png", "exitConfirm", "종료하기", () => this.leave("End", true)],
    ];
    for (const [file, key, caption, action] of buttons) {
      const rect = assets[file];
      const button = this.imageButton(key, caption, action, rect.width, rect.height);
      Object.assign(button.style, { position: "absolute", left: `${rect.x - panel.x}px`, top: `${rect.y - panel.y}px` });
      this.root.append(button);
    }
    this.dom.updateSize();
    this.focusFrame = requestAnimationFrame(() => {
      if (this.root.isConnected) this.root.querySelector("button")?.focus({ preventScroll: true });
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
  renderComputer() { renderComputerPanel(this); }
  renderNotebook() {
    this.title.textContent = "메모장";
    const header = this.root.querySelector(".sg-header");
    header.append(this.imageButton("notebookClose", "메모장 닫기", () => this.close(), 44, 44));
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
  }

  renderSmartphone() { renderSmartphonePanel(this); }
  renderTelephone() { renderSmartphonePanel(this); }
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
