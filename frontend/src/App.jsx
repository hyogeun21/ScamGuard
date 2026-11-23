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
import "./game/overlay.css";

export default function App() {
  const host = useRef(null);
  useEffect(() => {
    const game = new Phaser.Game({
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
    return () => game.destroy(true);
  }, []);
  return <div className="game-container" ref={host} />;
}
