import { Bet, Model, PlayerScore, RoundScore, ScoreBoard, State } from "./model";
import type { TichuNotificationMap } from "../types/tichu-contracts";
import { playerIdFromChannel } from "./utils";

export interface NotifsPacket {
  packet_type?: "single" | "sequence" | "resend" | "history" | string;
  data: Notif[];
  channel: string;
  move_id: string | number;
  table_id?: number | string;
  packet_id: string | number;
  prevpacket?: Record<number, number>;
  time?: string | number;
}

export type ReplayNotif = Notif & { player_id: number };

export class ReplayEngine {
  public readonly model: Model;

  private notifs: ReplayNotif[] = [];

  private notifIndex = 0;

  private ignoredNotifType = "";

  private scoreBoard: ScoreBoard = { rounds: [] };

  /** State at index i is the state before replaying notification i. */
  private states: State[] = [];

  constructor(
    rawGamelogs: NotifsPacket[] | { data?: { data?: NotifsPacket[] } } = [],
    players?: Player[],
    model?: Model,
  ) {
    this.model = model ?? new Model();
    this.loadGamelogs(rawGamelogs);
    if (players && players.length === 4) {
      this.init(players);
    }
  }

  public loadGamelogs(rawGamelogs: NotifsPacket[] | { data?: { data?: NotifsPacket[] } }): void {
    let gamelogs: NotifsPacket[] = Array.isArray(rawGamelogs) ? rawGamelogs : [];
    if (!Array.isArray(rawGamelogs) && Array.isArray((rawGamelogs as any)?.data?.data)) {
      gamelogs = (rawGamelogs as any).data.data as NotifsPacket[];
    }
    const clonedPackets: NotifsPacket[] = gamelogs.map((pkt) => ({
      ...pkt,
      move_id: String(pkt.move_id ?? ""),
      packet_id: String(pkt.packet_id ?? ""),
      data: Array.isArray(pkt.data) ? pkt.data.map((d) => ({ ...d })) : [],
    }));
    tidyUpGamelogs(clonedPackets);

    this.notifs = [];
    for (const packet of clonedPackets) {
      this.notifs.push(
        ...packet.data.map((data) => {
          const player_id = playerIdFromChannel(packet.channel);
          return { ...data, player_id, move_id: String(packet.move_id) };
        }),
      );
    }
    segmentNotifMoves(this.notifs);
  }

  public init(players: Player[]): void {
    this.model.init(players);
    this.notifIndex = 0;
    this.ignoredNotifType = "";
    this.states = [];
    this.scoreBoard = createScoreBoard(this.notifs, this.model.getPlayerIds());
    this.recordState();
  }

  public getState(): State {
    return this.model.getState();
  }

  public getNotifIndex(): number {
    return this.notifIndex;
  }

  public getNotifs(): ReplayNotif[] {
    return this.notifs;
  }

  public getIgnoredNotifType(): string {
    return this.ignoredNotifType;
  }

  public getScoreBoard(): ScoreBoard {
    return this.scoreBoard;
  }

  public stepBack(): boolean {
    if (this.notifIndex <= 0) return false;
    this.notifIndex--;
    this.model.setState(this.states[this.notifIndex]!);
    return true;
  }

  public stepForward(): boolean {
    if (this.notifIndex >= this.notifs.length) return false;
    const notif = this.notifs[this.notifIndex]!;
    this.notifIndex++;
    this.applyReplayNotif(notif);
    this.recordState();
    return true;
  }

  public applyReplayNotif(notif: ReplayNotif): void {
    const type = notif.type as string;
    const args = notif.args as any;
    if (type === "dealCards") {
      const playerId = Number(args.cards?.[0]?.location_arg ?? notif.player_id);
      this.model.dealCards(playerId, args.cards);
    } else if (type === "playCombo") {
      const playerId = Number(args.player_id);
      this.model.playCombo(playerId, args.cards, args.points);
    } else if (type === "pass") {
      const playerId = Number(args.player_id);
      this.model.pass(playerId);
    } else if (type === "grandTichuBet") {
      const playerId = Number(args.player_id);
      this.model.setBet(playerId, Number(args.bet) === 200 ? Bet.GRAND_TICHU : Bet.NO_BET_YET);
    } else if (type === "tichuBet") {
      const playerId = Number(args.player_id);
      this.model.setBet(playerId, Number(args.bet) === 100 ? Bet.TICHU : Bet.NO_BET);
    } else if (type === "gameStateMultipleActiveUpdate") {
      const playerIds = args.map((id: string | number) => Number(id));
      this.model.setActive(playerIds);
    } else if (type === "gameStateChange" && args.type === "activeplayer") {
      const playerId = Number(args.active_player);
      this.model.setActive([playerId]);
    } else if (type === "acceptCards") {
      this.model.acceptCards(notif.player_id);
    } else if (type === "passCards") {
      const cardIds: string[] = args.cardIds;
      this.model.passCards(notif.player_id, cardIds);
    } else if (type === "wishMade") {
      const wish = Number(args.wish);
      this.model.setWish(wish);
    } else if (type === "mahjongWishGranted") {
      this.model.setWish(0);
    } else if (type === "captureCards") {
      const playerId = Number(args.player_id);
      const trickValue = Number(args.trick_value);
      this.model.captureCards(playerId, trickValue);
    } else if (type === "newScores") {
      const playerIds = this.model.getPlayerIds();
      for (const playerId of playerIds) {
        const gamePoints = Number(args.newScores[`${playerId}`]);
        this.model.setGamePoints(playerId, isNaN(gamePoints) ? 0 : gamePoints);
      }
      this.model.beginNewRound();
    } else if (isIgnoredReplayNotif(notif)) {
      // fine
    } else {
      this.ignoredNotifType = type;
    }
  }

  public prevMove(): void {
    if (this.notifIndex <= 0) return;
    let sameMove = true;
    const moveId = this.notifs[this.notifIndex - 1]?.move_id;
    while (sameMove && this.notifIndex > 0) {
      this.stepBack();
      const prev = this.notifs[this.notifIndex - 1];
      sameMove = !!prev && moveId === prev?.move_id;
    }
  }

  public nextMove(): void {
    if (this.notifIndex >= this.notifs.length) return;
    let sameMove = true;
    const moveId = this.notifs[this.notifIndex]?.move_id;
    while (sameMove && this.notifIndex < this.notifs.length) {
      this.stepForward();
      const next = this.notifs[this.notifIndex];
      sameMove = !!next && next?.move_id === moveId;
    }
  }

  public prevRound(): void {
    while (this.notifIndex > 0) {
      this.prevMove();
      const cards = this.model.getState().passedCards;
      if (cards.length === 12 && !cards.some((c) => c.accepted)) return;
    }
  }

  public nextRound(): void {
    while (this.notifIndex < this.notifs.length) {
      this.nextMove();
      const cards = this.model.getState().passedCards;
      if (cards.length === 12 && !cards.some((c) => c.accepted)) return;
    }
  }

  private recordState(): void {
    this.states[this.notifIndex] = { ...this.model.getState() };
  }
}

export function isIgnoredReplayNotif(notif: Notif): boolean {
  const type = notif.type as string;
  const args = notif.args as any;
  if (type === "autopass") return true;
  if (type === "botSuggestion") return true;
  if (type === "confirmTichu") return true;
  if (type === "devConsole") return true;
  if (type === "hasBomb") return true;
  if (type === "log") return true;
  if (type === "playerGoOut") return true;
  if (type === "roundScore") return true;
  if (type === "simpleNode") return true;
  if (type === "tableWindow") return true;
  if (type === "updateReflexionTime") return true;
  if (type === "wakeupPlayers") return true;
  if (type === "gameStateChangePrivateArg") return true;
  if (type === "gameStateChange" && args?.type === "game") return true;
  if (type === "gameStateChange" && args?.type === "manager") return true;
  if (type === "gameStateChange" && args?.type === "multipleactiveplayer") return true;
  return false;
}

export function createScoreBoard(notifs: Notif[], playerIds: number[]): ScoreBoard {
  const rounds: RoundScore[] = [];
  let roundCount = 1;
  let newScores: Record<string, string | number> = {};
  let oldScores: Record<string, string | number> = {};
  for (const notif of notifs) {
    if ((notif.type as string) !== "newScores") continue;

    oldScores = newScores;
    newScores = (notif.args as TichuNotificationMap["newScores"]).newScores;

    const scores: PlayerScore[] = [];
    for (const id of playerIds) {
      const oldGamePoints = toNumber(oldScores[`${id}`]);
      const gamePoints = toNumber(newScores[`${id}`]);
      const roundPoints = gamePoints - oldGamePoints;
      scores.push({ id, gamePoints, roundPoints });
    }
    const round: RoundScore = { round: roundCount++, scores };
    rounds.push(round);
  }
  return { rounds };
}

function toNumber(s?: string | number): number {
  const n = Number(s ?? "") ?? 0;
  return isNaN(n) ? 0 : n;
}

export function tidyUpGamelogs(gamelogs: NotifsPacket[]): void {
  for (let index = 0; index < gamelogs.length; index++) {
    const thisPacket = gamelogs[index];
    if (!thisPacket) continue;

    const allIgnored = thisPacket.data.every(isIgnoredReplayNotif);
    if (allIgnored) {
      gamelogs.splice(index, 1);
      index -= 1;
      continue;
    }

    const prevPacket = gamelogs[index - 1];
    if (!prevPacket) continue;

    // All GT bets should be one move.
    const thisgt = thisPacket.data.some((notif) => (notif.type as string) === "grandTichuBet");
    const prevgt = prevPacket.data.some((notif) => (notif.type as string) === "grandTichuBet");
    if (thisgt && prevgt) thisPacket.move_id = prevPacket.move_id;

    // The last passCards
    const thispcjoined =
      thisPacket.data.length > 1 &&
      thisPacket.data.some((notif) => (notif.type as string) === "passCards");
    if (thispcjoined) {
      const pcData = thisPacket.data.filter((notif) => (notif.type as string) === "passCards");
      const otherData = thisPacket.data.filter((notif) => (notif.type as string) !== "passCards");
      const pcPacket = { ...thisPacket, data: pcData };
      thisPacket.data = otherData;
      gamelogs.splice(index, 0, pcPacket);
      index -= 1;
      continue;
    }

    // All PassCards moves should be one.
    const thispc =
      thisPacket.data.length === 1 &&
      thisPacket.data.some(
        (notif) =>
          (notif.type as string) === "passCards" ||
          (notif.type as string) === "gameStateMultipleActiveUpdate",
      );
    const prevpc =
      prevPacket.data.length === 1 &&
      prevPacket.data.some(
        (notif) =>
          (notif.type as string) === "passCards" ||
          (notif.type as string) === "gameStateMultipleActiveUpdate",
      );
    if (thispc && prevpc) thisPacket.move_id = prevPacket.move_id;

    // Make sure that public updates (/table) come before private updates (/player),
    // except do not swap public updates before passCards.
    if (String(thisPacket?.move_id) !== String(prevPacket?.move_id)) continue;
    if (!thisPacket?.channel.startsWith("/table/t")) continue;
    if (!prevPacket?.channel.startsWith("/player/p")) continue;
    if (prevPacket.data.some((notif) => (notif.type as string) === "passCards")) continue;
    swap(gamelogs, index, index - 1);
    index -= 2;
  }
}

/**
 * Re-assign sequential logical `move_id` values across flattened replay notifications so
 * batched bot steps, auto-passes, and round-end/new-round transitions each step individually.
 */
export function segmentNotifMoves(notifs: ReplayNotif[]): void {
  let moveCounter = 1;
  let currentPhase = "newScores";
  let dealCountInRound = 0;
  let acceptCountInRound = 0;
  let pendingPrefixForPlayer: number | null = null;

  for (let i = 0; i < notifs.length; i++) {
    const notif = notifs[i]!;
    const type = notif.type as string;
    const args = (notif.args ?? {}) as any;

    if (type === "newScores") {
      moveCounter++;
      currentPhase = "newScores";
      dealCountInRound = 0;
      acceptCountInRound = 0;
      pendingPrefixForPlayer = null;
    } else if (acceptCountInRound < 4) {
      if (type === "dealCards") {
        if (dealCountInRound < 4) {
          if (currentPhase !== "newScores" && currentPhase !== "deal8") {
            moveCounter++;
          }
          currentPhase = "deal8";
        } else if (dealCountInRound === 4) {
          moveCounter++;
          currentPhase = "deal6";
        }
        dealCountInRound++;
      } else if (type === "grandTichuBet" || (type === "tichuBet" && dealCountInRound <= 4)) {
        if (currentPhase !== "gt") {
          moveCounter++;
          currentPhase = "gt";
        }
      } else if (
        type === "passCards" ||
        (type === "tichuBet" && dealCountInRound > 4 && acceptCountInRound === 0)
      ) {
        if (currentPhase !== "passCards") {
          moveCounter++;
          currentPhase = "passCards";
        }
      } else if (type === "gameStateChange" && args.type === "activeplayer") {
        if (currentPhase === "passCards") {
          moveCounter++;
          currentPhase = "acceptCards";
        }
      } else if (type === "acceptCards") {
        if (currentPhase !== "acceptCards") {
          moveCounter++;
          currentPhase = "acceptCards";
        }
        acceptCountInRound++;
      }
    } else {
      if (type === "mahjongWishGranted") {
        let nextPlayPlayer: number | null = null;
        for (let j = i + 1; j < notifs.length; j++) {
          const nextNotif = notifs[j]!;
          const nextType = nextNotif.type as string;
          if (nextType === "playCombo") {
            nextPlayPlayer = Number((nextNotif.args as any)?.player_id);
            break;
          }
          if (nextType !== "tichuBet" && !isIgnoredReplayNotif(nextNotif)) break;
        }
        if (
          currentPhase !== "prePlay" ||
          (pendingPrefixForPlayer !== null &&
            nextPlayPlayer !== null &&
            pendingPrefixForPlayer !== nextPlayPlayer)
        ) {
          moveCounter++;
        }
        currentPhase = "prePlay";
        pendingPrefixForPlayer = nextPlayPlayer;
      } else if (type === "tichuBet") {
        const betPlayer = Number(args.player_id);
        if (
          currentPhase !== "prePlay" ||
          (pendingPrefixForPlayer !== null && pendingPrefixForPlayer !== betPlayer)
        ) {
          moveCounter++;
        }
        currentPhase = "prePlay";
        pendingPrefixForPlayer = betPlayer;
      } else if (type === "playCombo") {
        const playPlayer = Number(args.player_id);
        if (
          currentPhase === "prePlay" &&
          (pendingPrefixForPlayer === null || pendingPrefixForPlayer === playPlayer)
        ) {
          // Group with preceding mahjongWishGranted / tichuBet from the same turn
        } else {
          moveCounter++;
        }
        currentPhase = "playCombo";
        pendingPrefixForPlayer = null;
      } else if (type === "wishMade") {
        if (currentPhase !== "playCombo") {
          moveCounter++;
        }
        currentPhase = "wishMade";
      } else if (type === "pass") {
        moveCounter++;
        currentPhase = "pass";
        pendingPrefixForPlayer = null;
      } else if (type === "captureCards") {
        moveCounter++;
        currentPhase = "capture";
        pendingPrefixForPlayer = null;
      }
    }

    notif.move_id = String(moveCounter);
  }
}

function swap(gamelogs: NotifsPacket[], i: number, j: number): void {
  if (!gamelogs[i]) return;
  if (!gamelogs[j]) return;
  const temp = gamelogs[i];
  gamelogs[i] = gamelogs[j]!;
  gamelogs[j] = temp!;
}
