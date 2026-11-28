# 전체 이미지 에셋 · v3

모든 PNG를 public/assets/에 넣습니다. 실제 이미지 파일은 ZIP에 포함되지 않았습니다.
가로×세로 단위 px, 1920×1080 내부 기준 권장 원본 크기입니다.
2배 해상도 원본도 가능하지만 비율을 유지하고 표시 크기는 코드에서 맞춥니다.
Windows에서 확장자가 숨겨져 있으면 .png를 중복 입력하지 마세요.

| 코드 키                  | 파일명                         | 권장 크기     |
| ------------------------ | ------------------------------ | ------------- |
| `mainBg`                 | `main-bg.png`                  | **1920×1080** |
| `mainStart`              | `main-start.png`               | **420×96**    |
| `mainHelp`               | `main-help.png`                | **420×96**    |
| `mainExit`               | `main-exit.png`                | **420×96**    |
| `exitPanel`              | `exit-panel.png`               | **1000×650**  |
| `exitClose`              | `exit-close.png`               | **250×85**    |
| `exitConfirm`            | `exit-confirm.png`             | **250×85**    |
| `helpPanel`              | `help-panel.png`               | **1200×840**  |
| `helpClose`              | `help-close.png`               | **250×85**    |
| `scenarioBg`             | `scenario-bg.png`              | **1920×1080** |
| `scenario1`              | `scenario-1.png`               | **650×220**   |
| `scenario2`              | `scenario-2.png`               | **650×220**   |
| `scenario3`              | `scenario-3.png`               | **650×220**   |
| `scenario4`              | `scenario-4.png`               | **650×220**   |
| `scenarioMain`           | `scenario-main.png`            | **400×90**    |
| `scenarioStart`          | `scenario-start.png`           | **400×90**    |
| `roomBg`                 | `room-bg.png`                  | **1920×1080** |
| `player`                 | `player.png`                   | **76×100**    |
| `smartphone`             | `smartphone.png`               | **70×110**    |
| `telephone`              | `telephone.png`                | **130×90**    |
| `notebook`               | `notebook.png`                 | **100×120**   |
| `computer`               | `computer.png`                 | **160×120**   |
| `computerPanel`          | `computer-panel.png`           | **1440×900**  |
| `computerInquiry`        | `computer-inquiry.png`         | **300×85**    |
| `computerPaymentConfirm` | `computer-payment-confirm.png` | **300×85**    |
| `computerWithdraw`       | `computer-withdraw.png`        | **300×85**    |
| `door`                   | `door.png`                     | **100×180**   |
| `doorPanel`              | `door-panel.png`               | **1500×960**  |
| `submitConfirmPanel`     | `submit-confirm-panel.png`     | **1500×960**  |
| `evaluationWaitingPanel` | `evaluation-waiting-panel.png` | **1500×960**  |
| `evaluationResultPanel`  | `evaluation-result-panel.png`  | **1500×960**  |
| `verdictNormal`          | `verdict-normal.png`           | **250×85**    |
| `verdictScam`            | `verdict-scam.png`             | **250×85**    |
| `finalSubmit`            | `final-submit.png`             | **250×85**    |
| `submitConfirm`          | `submit-confirm.png`           | **250×85**    |
| `evaluationRetry`        | `evaluation-retry.png`         | **250×85**    |
| `retryGame`              | `retry-game.png`               | **250×85**    |
| `eIcon`                  | `e-icon.png`                   | **60×60**     |
| `pausePanel`             | `pause-panel.png`              | **1000×650**  |
| `pauseClose`             | `pause-close.png`              | **250×85**    |
| `pauseMain`              | `pause-main.png`               | **250×85**    |
| `notebookPanel`          | `notebook-panel.png`           | **1100×900**  |
| `notebookClose`          | `notebook-close.png`           | **250×85**    |
| `smartphonePanel`        | `smartphone-panel.png`         | **1080×940**  |
| `telephonePanel`         | `telephone-panel.png`          | **1080×940**  |
| `investigationClose`     | `investigation-close.png`      | **65×65**     |
| `investigationBack`      | `investigation-back.png`       | **250×85**    |
| `additionalQuestion`     | `additional-question.png`      | **250×85**    |
| `telephoneCall`          | `telephone-call.png`           | **250×85**    |
| `telephoneEnd`           | `telephone-end.png`            | **250×85**    |
| `endBg`                  | `game-end.png`                 | **1920×1080** |

## 이미지에 포함할 것

- main-bg/scenario-bg/room-bg/game-end: 전체 배경. 별도 버튼/플레이어/오브젝트는 합치지 않습니다.
- help-panel: 게임방법 설명까지 포함하는 기준. exit-panel은 종료 안내, pause-panel은 일시정지 제목 포함 가능.
- 메모장/스마트폰/전화기/컴퓨터/문 패널: 장식 테두리와 빈 배경만. 가변 제목/본문/입력란/버튼은 코드가 배치합니다.
- 문 확인/대기/결과 패널도 빈 배경으로 제작합니다. 내용은 코드가 표시합니다.
- 버튼: 글자 포함 PNG. 코드가 이미지를 표시하며 누락 시에만 임시 글자 버튼 표시.
- 배경 외 이미지는 투명 PNG, 과도한 투명 여백을 피하세요.
- 말풍선/질문 목록/행동 체크박스는 CSS/HTML로 그리므로 별도 이미지 불필요.

## 조정 위치

config.js의 UI/OBJECTS/PLAYER/ROOM/ROOM_COLLIDERS, overlay.css의 안쪽 여백/글자 크기를 수정합니다.
HTML 이미지 버튼은 원본 비율을 유지하며 최대 표시 공간에 맞춥니다.
문 정상/사기 선택은 체크된 쪽에 코드로 강조 테두리를 표시하므로 선택 상태 PNG가 없어도 됩니다.
실제 원본 에셋의 여백과 배치는 미확인 상태로 최종 조정이 필요합니다.
문 하단 메인메뉴 버튼은 긴 글자를 위해 300×85 공간에 기존 pause-main.png를 비율 유지해서 표시합니다.
종료 화면의 같은 버튼은400×136으로 확대해 비율을 유지합니다.
