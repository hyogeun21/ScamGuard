export const AUDIO_SETTINGS = {
  bgm: { file: "bgm-calm-loop.wav", volume: 0.28, loop: true },
  computer: { file: "computer-click.wav", volume: 0.60 },
  smartphone: { file: "smartphone-tap.wav", volume: 0.65 },
  interaction: { file: "interaction-press.wav", volume: 0.60 },
  footsteps: { file: "player-footsteps.wav", volume: 0.45, loop: true },
};
export const soundForObject = (id) => id === "computer" ? "computer"
  : ["smartphone", "telephone"].includes(id) ? "smartphone" : "interaction";
export function preloadGameAudio(scene) {
  for (const [id, entry] of Object.entries(AUDIO_SETTINGS))
    scene.load.audio(`sg-${id}`, `/audio/${entry.file}`);
}
const controllers = new WeakMap();
export class GameAudio {
  constructor(game, host = globalThis.document) {
    this.game = game;
    this.manager = game.sound;
    this.host = host;
    this.sounds = new Map();
    this.bgmWanted = false;
    this.suspended = !!host?.hidden;
    this.destroyed = false;
    this.pendingEffect = null;
    this.oldPauseOnBlur = this.manager.pauseOnBlur;
    this.manager.pauseOnBlur = false;
    this.onUnlock = () => {
      this.syncBgm();
      const effect = this.pendingEffect;
      this.pendingEffect = null;
      if (effect && !this.suspended) this.playEffect(effect);
    };
    this.onGesture = (event) => {
      if (event.repeat) return;
      if (this.manager.locked) this.manager.unlock();
      else this.syncBgm();
    };
    this.onBlur = () => this.setSuspended(true);
    this.onFocus = () => this.setSuspended(!!this.host?.hidden);
    this.onVisibility = () => this.setSuspended(!!this.host?.hidden);
    this.manager.on("unlocked", this.onUnlock);
    game.events.on("blur", this.onBlur);
    game.events.on("focus", this.onFocus);
    game.events.once("destroy", () => this.destroy());
    host?.addEventListener("pointerdown", this.onGesture, true);
    host?.addEventListener("keydown", this.onGesture, true);
    host?.addEventListener("visibilitychange", this.onVisibility);
  }
  sound(id) {
    if (this.destroyed) return null;
    if (!this.sounds.has(id)) {
      if (!this.game.cache.audio.exists(`sg-${id}`)) return null;
      const { volume, loop = false } = AUDIO_SETTINGS[id];
      this.sounds.set(id, this.manager.add(`sg-${id}`, { volume, loop }));
    }
    return this.sounds.get(id);
  }
  startBgm() { this.bgmWanted = true; this.syncBgm(); }
  stopBgm() { this.bgmWanted = false; this.sounds.get("bgm")?.stop(); }
  syncBgm() {
    if (this.destroyed || this.suspended || !this.bgmWanted || this.manager.locked) return;
    const sound = this.sound("bgm");
    if (sound?.isPaused) sound.resume();
    else if (sound && !sound.isPlaying) sound.play();
  }
  playEffect(id) {
    if (this.destroyed || this.suspended) return;
    if (this.manager.locked) {
      this.pendingEffect = id;
      this.manager.unlock();
      return;
    }
    const sound = this.sound(id);
    if (!sound) return;
    if (sound.isPlaying || sound.isPaused) sound.stop();
    sound.play();
  }
  interact(objectId) { this.playEffect(soundForObject(objectId)); }
  setFootsteps(moving) {
    if (!moving || this.suspended || this.manager.locked || this.destroyed) {
      const sound = this.sounds.get("footsteps");
      if (sound?.isPlaying || sound?.isPaused) sound.stop();
      return;
    }
    const sound = this.sound("footsteps");
    if (sound && !sound.isPlaying) sound.play();
  }
  setSuspended(value) {
    if (this.destroyed) return;
    this.suspended = value;
    if (value) {
      this.pendingEffect = null;
      for (const [id, sound] of this.sounds) {
        if (id === "bgm") { if (sound.isPlaying) sound.pause(); }
        else if (sound.isPlaying || sound.isPaused) sound.stop();
      }
    } else this.syncBgm();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.manager.off("unlocked", this.onUnlock);
    this.game.events.off("blur", this.onBlur);
    this.game.events.off("focus", this.onFocus);
    this.host?.removeEventListener("pointerdown", this.onGesture, true);
    this.host?.removeEventListener("keydown", this.onGesture, true);
    this.host?.removeEventListener("visibilitychange", this.onVisibility);
    for (const sound of this.sounds.values()) sound.destroy();
    this.sounds.clear();
    this.manager.pauseOnBlur = this.oldPauseOnBlur;
  }
}
export function getGameAudio(game) {
  if (!controllers.has(game)) controllers.set(game, new GameAudio(game));
  return controllers.get(game);
}
