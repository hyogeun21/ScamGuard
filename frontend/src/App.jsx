import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import {
  BootScene,
  MainScene,
  ScenarioScene,
  RoomScene,
  EndScene,
} from "./game/scenes";
import { OverlayScene } from "./game/OverlayScene";
import "./game/fonts.css";
import "./game/overlay.css";

export default function App() {
  const host = useRef(null);
  useEffect(() => {
    let disposed = false;
    let game;
    const start = async () => {
      try {
        await document.fonts.load('400 28px "Noto Sans KR"', '사기예방 교육');
        await document.fonts.load('700 28px "Noto Sans KR"', '사기예방 교육');
      } catch (error) {
        console.warn("Noto Sans KR loading failed; using fallback font.", error);
      }
      if (disposed) return;
      game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: 1920,
      height: 1080,
      backgroundColor: "#172b30",
      dom: { createContainer: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: "arcade", arcade: { debug: false } },
      scene: [
        BootScene,
        MainScene,
        ScenarioScene,
        RoomScene,
        OverlayScene,
        EndScene,
      ],
    });
    };
    start();
    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, []);
  return <div className="game-container" ref={host} />;
}
