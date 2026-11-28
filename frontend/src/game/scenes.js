import { preloadGameAudio, getGameAudio } from "./gameAudio";
import { WALK_DISPLAY, walkDirection, registerPlayerWalk, updatePlayerWalk } from "./playerWalk";
import roomLayout from "./room-layout.json";
import questAnimation from "./quest-animation.json";
import { playerFacing, PLAYER_FRONT, PLAYER_CROPS, visiblePlayerSize, syncPlayerBody } from "./playerFacing";
import exitLayout from "./exit-layout.json";
import Phaser from "phaser";
import { ASSETS, UI, OBJECTS, PLAYER, ROOM, ROOM_COLLIDERS, DECORATIONS } from "./config";
import { SCENARIOS, getScenario } from "./content";
import { createRunData, nearestObject, rememberOnce, initialGuideTarget, investigationLockReason } from "./state";
import { moveWithCollisions, safeSpawn } from "./collision";

function label(scene, x, y, value, size = 30, color = "#edf0dc") {
  return scene.add
    .text(x, y, value, {
      fontFamily: "'Noto Sans KR', sans-serif",
      fontSize: `${size}px`,
      color,
      align: "center",
      wordWrap: { width: 1500 },
    })
    .setOrigin(0.5);
}
function background(scene, key) {
  if (scene.textures.exists(key))
    return scene.add.image(960, 540, key).setDisplaySize(1920, 1080);
  scene.add.rectangle(960, 540, 1920, 1080, 0x172d32);
  for (let i = 0; i < 15; i++)
    scene.add
      .line(0, 0, 120 + i * 120, 0, 120 + i * 120, 1080, 0x759483, 0.07)
      .setOrigin(0);
}
function button(scene, key, rect, caption, onClick) {
  const { x, y, w, h } = rect;
  let object;
  if (scene.textures.exists(key))
    object = scene.add.image(x, y, key).setDisplaySize(w, h);
  else {
    object = scene.add.container(x, y);
    const box = scene.add
      .rectangle(0, 0, w, h, 0x3a554f)
      .setStrokeStyle(2, 0xaab991);
    object.add([box, label(scene, 0, 0, caption, 30)]).setSize(w, h);
  }
  object.setInteractive({ useHandCursor: true });
  object.on("pointerover", () => object.setAlpha(0.8));
  object.on("pointerout", () => object.setAlpha(1));
  object.on("pointerdown", () => {
    if (scene.scene.isActive() && !scene.modalOpening) {
      getGameAudio(scene.game).interact("button");
      onClick();
    }
  });
  return object;
}
function registerEscape(scene, callback) {
  const handle = (event) => {
    if (!event.repeat && !scene.modalOpening) {
      getGameAudio(scene.game).interact("button");
      callback();
    }
  };
  scene.input.keyboard.on("keydown-ESC", handle);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.input.keyboard.off("keydown-ESC", handle),
  );
}
function enableModals(scene) {
  scene.modalOpening = false;
  const resume = () => {
    scene.modalOpening = false;
    scene.input.keyboard.resetKeys();
  };
  scene.events.on(Phaser.Scenes.Events.RESUME, resume);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.events.off(Phaser.Scenes.Events.RESUME, resume),
  );
}
function openOverlay(scene, data) {
  if (scene.modalOpening || scene.scene.isActive("Overlay")) return;
  scene.modalOpening = true;
  scene.stopWalking?.();
  scene.input.keyboard.resetKeys();
  scene.scene.launch("Overlay", { ...data, parentScene: scene.scene.key });
  scene.scene.pause();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    preloadGameAudio(this);
    label(this, 960, 500, "SCAMGUARD", 70, "#dfbd84");
    const status = label(this, 960, 610, "이미지 불러오는 중…", 25);
    this.missing = [];
    this.load.on("loaderror", (file) => this.missing.push(file.key));
    this.load.on("progress", (value) =>
      status.setText(`이미지 불러오는 중 ${Math.round(value * 100)}%`),
    );
    this.load.image("playerWalk", "/assets/player-walk-sheet.png");
    this.load.spritesheet("questFrames", "/assets/quest-bubble-frames.png", {
      frameWidth: questAnimation.width, frameHeight: questAnimation.height,
    });
    for (const [key, file] of Object.entries(ASSETS))
      this.load.image(key, `/assets/${file}`);
  }
  create() {
    // Ignore transparent padding without altering the replacement PNG.
    for (const [key, crop] of Object.entries(PLAYER_CROPS)) {
      if (this.textures.exists(key)) this.textures.get(key).add("profile", 0, crop.x, crop.y, crop.w, crop.h);
    }
    registerPlayerWalk(this);
    this.registry.set("missingAssets", this.missing);
    this.scene.start("Main");
  }
}

export class MainScene extends Phaser.Scene {
  constructor() {
    super("Main");
  }
  create() {
    getGameAudio(this.game).startBgm();
    enableModals(this);
    background(this, "mainBg");
    if (!this.textures.exists("mainBg")) {
      label(this, 960, 230, "SCAMGUARD", 100, "#dfbd84");
      label(this, 960, 350, "사기를 읽는 힘 · 사기방지 교육용 게임", 30);
      label(
        this,
        960,
        1020,
        "임시 화면 · public/assets에 이미지를 넣으면 해당 이미지로 표시됩니다.",
        21,
        "#9eafa0",
      );
    }
    button(this, "mainStart", UI.main.start, "게임시작", () =>
      this.scene.start("Scenario"),
    );
    button(this, "mainHelp", UI.main.help, "게임방법", () =>
      openOverlay(this, { type: "help" }),
    );
    button(this, "mainExit", UI.main.exit, "게임종료", () =>
      openOverlay(this, { type: "exit" }),
    );
  }
}

export class ScenarioScene extends Phaser.Scene {
  constructor() {
    super("Scenario");
  }
  create() {
    getGameAudio(this.game).startBgm();
    this.modalOpening = false;
    this.selectedId = null;
    background(this, "scenarioBg");
    if (!this.textures.exists("scenarioBg"))
      label(this, 960, 140, "시나리오 선택", 64, "#dfbd84");
    this.borders = [];
    SCENARIOS.forEach((s, i) => {
      const rect = UI.scenario.cards[i];
      button(
        this,
        `scenario${s.id}`,
        rect,
        `시나리오 ${s.id}\n${s.title}`,
        () => {
          this.selectedId = s.id;
          this.borders.forEach((border, index) =>
            border.setVisible(index === i),
          );
          this.message.setText(`시나리오 ${s.id} 선택됨`);
        },
      );
      this.borders.push(
        this.add
          .rectangle(rect.x, rect.y, rect.w + 12, rect.h + 12)
          .setFillStyle(0, 0)
          .setStrokeStyle(5, 0xf1c986)
          .setVisible(false),
      );
    });
    this.message = label(
      this,
      960,
      928,
      "플레이할 시나리오를 선택해주세요.",
      22,
    );
    button(this, "scenarioMain", UI.scenario.main, "메인화면으로 가기", () =>
      this.scene.start("Main"),
    );
    button(this, "scenarioStart", UI.scenario.start, "게임 시작하기", () => {
      if (this.selectedId === null) {
        this.message.setText("먼저 시나리오를 하나 선택해주세요.");
        return;
      }
      // 새 게임의 유일한 시작점: 이전 메모·조사·질문·평가·위치를 교체합니다.
      this.registry.set("runData", createRunData(this.selectedId));
      this.scene.start("Room");
    });
    registerEscape(this, () => this.scene.start("Main"));
  }
}

export class RoomScene extends Phaser.Scene {
  constructor() {
    super("Room");
  }
  create() {
    getGameAudio(this.game).startBgm();
    enableModals(this);
    this.run = this.registry.get("runData");
    if (!this.run) {
      this.scene.start("Scenario");
      return;
    }
    this.nearest = null;
    background(this, "roomBg");
    if (!this.textures.exists("roomBg")) {
      this.add
        .rectangle(960, 590, 1720, 800, 0x89927b)
        .setStrokeStyle(22, 0x496154);
      for (let y = 240; y < 950; y += 90)
        this.add.line(0, 0, 120, y, 1800, y, 0x496154, 0.3).setOrigin(0);
      this.add
        .rectangle(960, 680, 700, 290, 0x637f6b)
        .setStrokeStyle(4, 0xa6b28a);
    }
    label(
      this,
      960,
      80,
      `CASE 0${this.run.scenarioId} · ${getScenario(this.run.scenarioId).title}`,
      38,
    ).setDepth(100);
    const area = roomLayout.assets["room-play-area.png"];
    if (this.textures.exists("roomPlayArea")) this.add.image(area.x, area.y, "roomPlayArea")
      .setOrigin(0).setDisplaySize(area.width, area.height).setDepth(1);
    for (const data of DECORATIONS) this.add.image(data.x, data.y, data.id)
      .setDisplaySize(data.w, data.h).setDepth(10);
    this.solids = this.physics.add.staticGroup();
    for (const data of OBJECTS) {
      if (this.textures.exists(data.id))
        this.add
          .image(data.x, data.y, data.id)
          .setDisplaySize(data.w, data.h)
          .setDepth(10);
      else {
        this.add
          .rectangle(data.x, data.y, data.w, data.h, 0xcbb78d)
          .setStrokeStyle(3, 0x435e51)
          .setDepth(10);
        label(this, data.x, data.y + data.h / 2 + 28, data.name, 24).setDepth(
          11,
        );
      }
      this.solids.add(this.add.zone(data.x, data.y, data.bodyW, data.bodyH));
    }
    for (const r of ROOM_COLLIDERS)
      this.solids.add(this.add.zone(r.x, r.y, r.w, r.h));
    this.collisionRects = [
      ...OBJECTS.map((data) => ({
        x: data.x,
        y: data.y,
        w: data.bodyW,
        h: data.bodyH,
      })),
      ...ROOM_COLLIDERS,
    ];
    const { x, y } = safeSpawn(
      this.run.playerPosition,
      this.textures.exists("playerWalk") ? WALK_DISPLAY : PLAYER_FRONT,
      ROOM,
      this.collisionRects,
    );
    this.walkDirection = "front";
    this.hasWalkSprite = this.textures.exists("playerWalk");
    if (this.hasWalkSprite) this.player = this.physics.add.sprite(x, y, "playerWalk", "1")
      .setDisplaySize(WALK_DISPLAY.w, WALK_DISPLAY.h);
    else if (this.textures.exists("player"))
      this.player = this.physics.add
        .image(x, y, "player")
        .setDisplaySize(PLAYER_FRONT.w, PLAYER_FRONT.h);
    else {
      this.player = this.add
        .rectangle(x, y, PLAYER.w, PLAYER.h, 0xf0c078)
        .setStrokeStyle(3, 0x604a35);
      this.physics.add.existing(this.player);
    }
    this.player.setDepth(20);
    this.player.body.setCollideWorldBounds(true);
    this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
    // 이동은 연속 경로 충돌 검사로 결정합니다. Arcade의 중복 이동은 끕니다.
    this.player.body.moves = false;
    syncPlayerBody(this.player);
    this.eIcon = this.add.image(0, 0, "eIcon").setDisplaySize(146, 71).setDepth(100).setVisible(false);
    if (!this.anims.exists("questBlink")) this.anims.create({
      key: "questBlink", repeat: -1, frameRate: 1000,
      frames: questAnimation.durations.map((duration, frame) => ({ key: "questFrames", frame, duration: duration - 1 })),
    });
    this.questBubble = this.add.sprite(0, 0, "questFrames").setDisplaySize(60, 64)
      .setDepth(100).setVisible(false).play("questBlink");
    const notice = roomLayout.assets["new-message-status.png"];
    this.notice = this.add.image(notice.x, notice.y, "newMessageStatus").setOrigin(0)
      .setDisplaySize(notice.width, notice.height).setDepth(100).setVisible(false);
    this.noticeText = label(this, notice.text.x, notice.text.y, notice.text.content, notice.text.fontSize, "#FFFFFF")
      .setDepth(101).setVisible(false);
    this.noticeText.setFontStyle("bold");
    this.hint = label(this, 960, 1066, "WASD 이동 · E 상호작용 · ESC 일시정지", 18).setDepth(100);

    this.keys = this.input.keyboard.addKeys({
      up: "W",
      left: "A",
      down: "S",
      right: "D",
    });
    this.interact = (event) => {
      if (event.repeat || this.modalOpening || !this.nearest) return;
      const locked = investigationLockReason(this.run, this.nearest.id);
      if (locked) {
        this.hint.setText(locked);
        return;
      }
      getGameAudio(this.game).interact(this.nearest.id);
      this.player.body.setVelocity(0);
      const fresh = !this.run.investigatedObjects.includes(this.nearest.id);
      rememberOnce(this.run.investigatedObjects, this.nearest.id);
      this.updateQuestGuide();
      if (fresh && ["smartphone", "computer"].includes(this.nearest.id)) {
        this.notice.setVisible(true);
        this.noticeText.setVisible(true);
        this.noticeTimer?.remove();
        this.noticeTimer = this.time.delayedCall(2500, () => {
          this.notice.setVisible(false); this.noticeText.setVisible(false);
        });
      }
      openOverlay(this, {
        type: this.nearest.id,
        scenarioId: this.run.scenarioId,
      });
    };
    this.updateQuestGuide();
    this.input.keyboard.on("keydown-E", this.interact);
    registerEscape(this, () => {
      this.player.body.setVelocity(0);
      openOverlay(this, { type: "pause" });
    });
    this.blur = () => {
      if (this.scene.isActive() && !this.modalOpening) {
        this.player.body.setVelocity(0);
        openOverlay(this, { type: "pause" });
      }
    };
    this.game.events.on(Phaser.Core.Events.BLUR, this.blur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      getGameAudio(this.game).setFootsteps(false);
      this.input.keyboard.off("keydown-E", this.interact);
      this.game.events.off(Phaser.Core.Events.BLUR, this.blur);
    });
  }
  stopWalking() {
    getGameAudio(this.game).setFootsteps(false);
    if (this.hasWalkSprite) {
      updatePlayerWalk(this.player, this.walkDirection, false);
      syncPlayerBody(this.player);
    }
  }
  updateQuestGuide() {
    const id = initialGuideTarget(this.run);
    const target = OBJECTS.find((object) => object.id === id);
    this.questBubble.setVisible(!!target);
    if (target) this.questBubble.setPosition(
      target.x, Math.max(ROOM.y + 40, target.y - target.h / 2 - 45),
    );
  }
  update(time, delta) {
    if (!this.player?.body || !this.keys || this.modalOpening) return;
    const direction = new Phaser.Math.Vector2(
      Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
    );
    const pose = playerFacing(direction.x, direction.y);
    this.walkDirection = walkDirection(direction.x, direction.y, this.walkDirection);
    if (!this.hasWalkSprite && pose && this.player.setTexture && this.textures.exists(pose.key)) {
      this.player.setTexture(pose.key, pose.frame ?? "__BASE").setFlipX(pose.flipX).setDisplaySize(pose.width, pose.height);
    }
    direction.normalize().scale(PLAYER.speed);
    const seconds = Math.min(delta, 100) / 1000;
    const next = moveWithCollisions(
      this.player,
      { x: direction.x * seconds, y: direction.y * seconds },
      visiblePlayerSize(this.player),
      ROOM,
      this.collisionRects,
    );
    const moving = Math.hypot(next.x - this.player.x, next.y - this.player.y) > 0.01 && direction.lengthSq() > 0;
    getGameAudio(this.game).setFootsteps(moving);
    this.player.setPosition(next.x, next.y);
    if (this.hasWalkSprite) updatePlayerWalk(this.player, this.walkDirection, moving);
    syncPlayerBody(this.player);
    this.run.playerPosition = { x: this.player.x, y: this.player.y };
    this.nearest = nearestObject(this.player, OBJECTS, ROOM.interactionRange);
    const locked = this.nearest && investigationLockReason(this.run, this.nearest.id);
    this.eIcon.setVisible(!!this.nearest && !locked);
    this.updateQuestGuide();
    if (this.nearest) {
      const x = this.nearest.x;
      const y = Math.max(ROOM.y + 40, this.nearest.y - this.nearest.h / 2 - 45);
      this.eIcon.setPosition(x, y);
      if (this.questBubble.visible && initialGuideTarget(this.run) === this.nearest.id)
        this.questBubble.setX(x - 120);
      this.hint.setText(locked || `${this.nearest.name} · E키로 조사하기`);
    } else this.hint.setText("WASD 이동 · E 상호작용 · ESC 일시정지");
  }
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super("End");
  }
  create() {
    getGameAudio(this.game).stopBgm();
    this.modalOpening = false;
    background(this, "endBg");
    if (!this.textures.exists("endBg")) {
      label(this, 960, 420, "게임이 종료되었습니다.", 66, "#dfbd84");
      label(
        this,
        960,
        535,
        "다시하기를 누르면 메인화면으로 돌아갑니다.",
        29,
      );
    }
    button(
      this,
      "endRetry",
      (() => {
        const rect = exitLayout.scenes["game-end"].assets["retry-game.png"];
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
      })(),
      "다시하기",
      () => {
        this.registry.remove("runData");
        this.scene.start("Main");
      },
    );
  }
}
