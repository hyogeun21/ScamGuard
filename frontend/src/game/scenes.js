import Phaser from "phaser";
import { ASSETS, UI, OBJECTS, PLAYER, ROOM, ROOM_COLLIDERS } from "./config";
import { SCENARIOS, getScenario } from "./content";
import { createRunData, nearestObject, rememberOnce } from "./state";
import { moveWithCollisions, safeSpawn } from "./collision";

function label(scene, x, y, value, size = 30, color = "#edf0dc") {
  return scene.add
    .text(x, y, value, {
      fontFamily: "Arial, sans-serif",
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
    if (scene.scene.isActive() && !scene.modalOpening) onClick();
  });
  return object;
}
function registerEscape(scene, callback) {
  const handle = (event) => {
    if (!event.repeat && !scene.modalOpening) callback();
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
  scene.input.keyboard.resetKeys();
  scene.scene.launch("Overlay", { ...data, parentScene: scene.scene.key });
  scene.scene.pause();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    label(this, 960, 500, "SCAMGUARD", 70, "#dfbd84");
    const status = label(this, 960, 610, "이미지 불러오는 중…", 25);
    this.missing = [];
    this.load.on("loaderror", (file) => this.missing.push(file.key));
    this.load.on("progress", (value) =>
      status.setText(`이미지 불러오는 중 ${Math.round(value * 100)}%`),
    );
    for (const [key, file] of Object.entries(ASSETS))
      this.load.image(key, `/assets/${file}`);
  }
  create() {
    this.registry.set("missingAssets", this.missing);
    this.scene.start("Main");
  }
}

export class MainScene extends Phaser.Scene {
  constructor() {
    super("Main");
  }
  create() {
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
      825,
      "플레이할 시나리오를 선택해주세요.",
      27,
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
      PLAYER,
      ROOM,
      this.collisionRects,
    );
    if (this.textures.exists("player"))
      this.player = this.physics.add
        .image(x, y, "player")
        .setDisplaySize(PLAYER.w, PLAYER.h);
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
    this.player.body.updateFromGameObject();
    if (this.textures.exists("eIcon"))
      this.eIcon = this.add.image(0, 0, "eIcon").setDisplaySize(60, 60);
    else {
      this.eIcon = this.add.container(0, 0, [
        this.add.rectangle(0, 0, 60, 60, 0xffdf9e).setStrokeStyle(3, 0x604a35),
        label(this, 0, 0, "E", 35, "#263e32"),
      ]);
    }
    this.eIcon.setDepth(50).setVisible(false);
    this.hint = label(
      this,
      960,
      1020,
      "WASD 이동 · E 상호작용 · ESC 일시정지",
      27,
    ).setDepth(100);

    this.keys = this.input.keyboard.addKeys({
      up: "W",
      left: "A",
      down: "S",
      right: "D",
    });
    this.interact = (event) => {
      if (event.repeat || this.modalOpening || !this.nearest) return;
      this.player.body.setVelocity(0);
      rememberOnce(this.run.investigatedObjects, this.nearest.id);
      openOverlay(this, {
        type: this.nearest.id,
        scenarioId: this.run.scenarioId,
      });
    };
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
      this.input.keyboard.off("keydown-E", this.interact);
      this.game.events.off(Phaser.Core.Events.BLUR, this.blur);
    });
  }
  update(time, delta) {
    if (!this.player?.body || !this.keys || this.modalOpening) return;
    const direction = new Phaser.Math.Vector2(
      Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
    );
    direction.normalize().scale(PLAYER.speed);
    const seconds = Math.min(delta, 100) / 1000;
    const next = moveWithCollisions(
      this.player,
      { x: direction.x * seconds, y: direction.y * seconds },
      PLAYER,
      ROOM,
      this.collisionRects,
    );
    this.player.setPosition(next.x, next.y);
    this.player.body.updateFromGameObject();
    this.run.playerPosition = { x: this.player.x, y: this.player.y };
    this.nearest = nearestObject(this.player, OBJECTS, ROOM.interactionRange);
    this.eIcon.setVisible(!!this.nearest);
    if (this.nearest) {
      this.eIcon.setPosition(
        this.nearest.x,
        this.nearest.y - this.nearest.h / 2 - 50,
      );
      this.hint.setText(`${this.nearest.name} · E키로 조사하기`);
    } else this.hint.setText("WASD 이동 · E 상호작용 · ESC 일시정지");
  }
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super("End");
  }
  create() {
    this.modalOpening = false;
    background(this, "endBg");
    if (!this.textures.exists("endBg")) {
      label(this, 960, 420, "게임이 종료되었습니다.", 66, "#dfbd84");
      label(
        this,
        960,
        535,
        "브라우저 탭을 닫거나 메인 화면으로 돌아갈 수 있습니다.",
        29,
      );
    }
    button(
      this,
      "pauseMain",
      { x: 960, y: 800, w: 400, h: 136 },
      "메인화면으로가기",
      () => this.scene.start("Main"),
    );
  }
}
