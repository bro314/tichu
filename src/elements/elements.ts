import { GameModel } from "./game-model";
import "./tichu-card";
import "./tichu-stock";
import "./tichu-animation-layer";
import "./tichu-replay";
import "./tichu-status";
import "./tichu-player-panel";
import "./tichu-value-choice";
import "./tichu-last-played";
import "./tichu-pass-area";
import "./tichu-action-bar";
import "./tichu-hand";
import "./tichu-played-cards";
import "./tichu-trick-modal";
import "./tichu-game";

export { GameModel } from "./game-model";
export { TichuCard } from "./tichu-card";
export { TichuStock } from "./tichu-stock";
export { TichuPlayerPanel } from "./tichu-player-panel";
export { TichuValueChoice } from "./tichu-value-choice";
export { TichuLastPlayed } from "./tichu-last-played";
export { TichuPassArea } from "./tichu-pass-area";
export { TichuActionBar } from "./tichu-action-bar";
export { TichuHand } from "./tichu-hand";
export { TichuPlayedCards } from "./tichu-played-cards";
export { TichuTrickModal } from "./tichu-trick-modal";
export {
  TichuAnimationLayer,
  shouldAnimate,
  getAnimationLayer,
  scaleAnimMs,
} from "./tichu-animation-layer";
export type { CardFlight } from "./tichu-animation-layer";
export { TichuGame } from "./tichu-game";

declare global {
  interface Window {
    gameModel: GameModel;
  }
}

if (typeof document !== "undefined" && document.documentElement) {
  const themeUrl = typeof g_gamethemeurl !== "undefined" ? g_gamethemeurl : "";
  document.documentElement.style.setProperty("--icon-url", `url(${themeUrl}img/tichu-icons.png)`);
  document.documentElement.style.setProperty(
    "--table-icons-url",
    `url(${themeUrl}img/tichu-icons-table.png)`,
  );
  document.documentElement.style.setProperty(
    "--mahjong-bg-url",
    `url(${themeUrl}img/tichu-mahjong.png)`,
  );
  document.documentElement.style.setProperty(
    "--tiki-mahjong-bg-url",
    `url(${themeUrl}img/tiki-tichu-mahjong.png)`,
  );
}

if (typeof window !== "undefined" && !window.gameModel) {
  window.gameModel = new GameModel();
}
