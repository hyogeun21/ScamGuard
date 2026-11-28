import spec from "./player-walk.json" with { type: "json" };

// One shared crop for every frame removes padding without shifting the feet.
export const WALK_CROP = { x: 20, y: 50, w: 359, h: 570 };
export const WALK_DISPLAY = { w: WALK_CROP.w / WALK_CROP.h * 143, h: 143 };
export const WALK_SPEC = spec;
export function walkDirection(dx, dy, previous = "front") {
  if (dx) return dx < 0 ? "left" : "right";
  if (dy) return dy < 0 ? "back" : "front";
  return previous;
}
export function walkFrameRect(index) {
  return { x: index % spec.columns * spec.frameWidth + WALK_CROP.x,
    y: Math.floor(index / spec.columns) * spec.frameHeight + WALK_CROP.y,
    w: WALK_CROP.w, h: WALK_CROP.h };
}
export function registerPlayerWalk(scene) {
  if (!scene.textures.exists("playerWalk")) return;
  const texture = scene.textures.get("playerWalk");
  for (let index = 0; index < spec.columns * spec.rows; index++) {
    const r = walkFrameRect(index);
    if (!texture.has(String(index))) texture.add(String(index), 0, r.x, r.y, r.w, r.h);
  }
  for (const [direction, definition] of Object.entries(spec.animations)) {
    const key = `player-walk-${direction}`;
    if (!scene.anims.exists(key)) scene.anims.create({ key,
      frames: definition.walk.map(frame => ({ key: "playerWalk", frame: String(frame) })),
      frameRate: spec.frameRate, repeat: -1,
    });
  }
}
export function updatePlayerWalk(sprite, direction, moving) {
  sprite.setFlipX(false); // Left has its own frames, so no additional mirroring.
  if (moving) sprite.anims.play(`player-walk-${direction}`, true);
  else {
    sprite.anims.stop();
    sprite.setFrame(String(spec.animations[direction].idle));
  }
  sprite.setDisplaySize(WALK_DISPLAY.w, WALK_DISPLAY.h);
}
