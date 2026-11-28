export const PLAYER_CROPS = { playerSide: { x: 172, y: 153, w: 603, h: 1341 } };
// All poses share a height. Collision uses the widest pose so turning stays safe.
export const PLAYER_POSES = {
  "player": {
    "w": 62.9528,
    "h": 110
  },
  "player-back": {
    "w": 63.313,
    "h": 110
  },
  "player-side": {
    "w": 49.4631,
    "h": 110
  }
};
export const PLAYER_SCALE = 1.3;
for (const pose of Object.values(PLAYER_POSES)) {
  pose.w *= PLAYER_SCALE;
  pose.h *= PLAYER_SCALE;
}
export const PLAYER_SIZE = { w: Math.max(...Object.values(PLAYER_POSES).map((pose) => pose.w)), h: PLAYER_POSES.player.h, sideW: PLAYER_POSES["player-side"].w };
export const PLAYER_FRONT = PLAYER_POSES.player;
export function playerFacing(dx, dy) {
  if (dx) return { key: "playerSide", frame: "profile", flipX: dx < 0, width: PLAYER_POSES["player-side"].w, height: PLAYER_SIZE.h };
  if (dy) {
    const pose = dy < 0 ? PLAYER_POSES["player-back"] : PLAYER_FRONT;
    return { key: dy < 0 ? "playerBack" : "player", flipX: false, width: pose.w, height: pose.h };
  }
  return null;
}

// The sprite frame excludes transparent padding. Match Arcade and custom collision to it.
export function visiblePlayerSize(sprite) {
  return { w: sprite.displayWidth, h: sprite.displayHeight };
}
export function syncPlayerBody(sprite) {
  sprite.body.setSize(sprite.width, sprite.height, false);
  sprite.body.setOffset(0, 0);
  sprite.body.updateFromGameObject();
}
