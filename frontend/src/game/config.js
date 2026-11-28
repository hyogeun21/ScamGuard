import { PLAYER_SIZE } from "./playerFacing";
import roomLayout from "./room-layout.json";
import scenarioLayout from "./scenario-layout.json";
import mainMenuLayout from "./main-menu-layout.json";

// JSON uses top-left coordinates; Phaser buttons use center coordinates.
function menuButton(file) {
  const rect = mainMenuLayout.buttons[file];
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
}

function scenarioRect(file) {
  const rect = scenarioLayout.assets[file];
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
}

// x/y는 이미지 중심, w/h는 1920×1080 좌표계의 표시 크기입니다.
export const UI = {
  main: {
    start: menuButton("main-start.png"),
    help: menuButton("main-help.png"),
    exit: menuButton("main-exit.png"),
  },
  scenario: {
    cards: [1, 2, 3, 4].map((id) => scenarioRect(`scenario-${id}.png`)),
    main: scenarioRect("scenario-main.png"),
    start: scenarioRect("scenario-start.png"),
  },
  // 팝업 안쪽 텍스트·버튼 위치는 overlay.css에서 조절합니다.
  popup: { w: 1000, h: 650 },
  help: { w: 1200, h: 840 },
  notebook: { w: 1000, h: 789 },
  investigation: { w: 1080, h: 940 },
  computer: { w: 1440, h: 900 },
  door: { w: 910, h: 718 },
};

export const ASSETS = {
  mainBg: "main-bg.png",
  mainStart: "main-start.png",
  mainHelp: "main-help.png",
  mainExit: "main-exit.png",
  exitPanel: "exit-panel.png",
  exitClose: "exit-close.png",
  exitConfirm: "exit-confirm.png",
  helpPanel: "help-panel.png",
  helpClose: "help-close.png",
  scenarioBg: "scenario-bg.png",
  scenario1: "scenario-1.png",
  scenario2: "scenario-2.png",
  scenario3: "scenario-3.png",
  scenario4: "scenario-4.png",
  scenarioMain: "scenario-main.png",
  scenarioStart: "scenario-start.png",
  roomBg: "room-bg.png",
  roomPlayArea: "room-play-area.png",
  playerBack: "player-back.png",
  playerSide: "player-side.png",
  bed: "bed.png",
  bookshelf: "bookshelf.png",
  newMessageStatus: "new-message-status.png",
  player: "player.png",
  smartphone: "smartphone.png",
  telephone: "telephone.png",
  notebook: "notebook.png",
  notebookAddSelection: "notebook-add-selection.png",
  computer: "computer.png",
  computerPanel: "computer-panel.png",
  computerInquiry: "computer-inquiry.png",
  computerPaymentConfirm: "computer-payment-confirm.png",
  computerWithdraw: "computer-withdraw.png",
  door: "door.png",
  doorPanel: "door-panel.png",
  doorClose: "door-close.png",
  submitConfirmPanel: "submit-confirm-panel.png",
  evaluationWaitingPanel: "evaluation-waiting-panel.png",
  evaluationResultPanel: "evaluation-result-panel.png",
  verdictNormal: "verdict-normal.png",
  verdictScam: "verdict-scam.png",
  finalSubmit: "final-submit.png",
  submitConfirm: "submit-confirm.png",
  evaluationRetry: "evaluation-retry.png",
  retryGame: "retry-game.png",
  endRetry: "retry-game.png",
  eIcon: "e-icon.png",
  pausePanel: "pause-panel.png",
  pauseClose: "pause-close.png",
  pauseMain: "pause-main.png",
  notebookPanel: "notebook-panel.png",
  notebookClose: "notebook-close.png",
  smartphonePanel: "smartphone-panel.png",
  telephonePanel: "telephone-panel.png",
  investigationClose: "investigation-close.png",
  investigationBack: "investigation-back.png",
  additionalQuestion: "additional-question.png",
  telephoneCall: "telephone-call.png",
  telephoneEnd: "telephone-end.png",
  // 선택 에셋: 없으면 코드로 종료 화면을 표시합니다.
  endBg: "game-end.png",
};
const roomRect = (file) => {
  const r = roomLayout.assets[file];
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
};
export const OBJECTS = [
  ["smartphone", "스마트폰"], ["notebook", "메모장"],
  ["computer", "컴퓨터"], ["door", "문"],
].map(([id, name]) => {
  const r = roomRect(`${id}.png`);
  return { id, name, ...r, bodyW: r.w, bodyH: r.h, approachFrom: "below", approachPadding: 60, ...(id === "door" ? { interactionRange: 280 } : {}) };
});
export const DECORATIONS = ["bed", "bookshelf"].map((id) => ({ id, ...roomRect(`${id}.png`) }));
export const PLAYER = { w: PLAYER_SIZE.w, h: PLAYER_SIZE.h, speed: 330 };
export const PLAYER_SPAWN = roomRect("player.png");
export const ROOM = {
  x: roomLayout.room.x, y: roomLayout.room.y,
  w: roomLayout.room.width, h: roomLayout.room.height, interactionRange: 200,
};
export const ROOM_COLLIDERS = DECORATIONS.map(({ x, y, w, h }) => ({ x, y, w, h }));
