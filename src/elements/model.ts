import { BehaviorSubject } from "rxjs";
import { Bet } from "../types/tichu-contracts";
import type {
  Card,
  CardData,
  RoundBetOutcome,
  RoundScoreRecord,
  TichuNotificationMap as NotifTypes,
} from "../types/tichu-contracts";
import { select } from "./utils";

export { Bet };
export type { Card, CardData, NotifTypes, RoundBetOutcome, RoundScoreRecord };

export interface ScoreBoard {
  rounds: RoundScore[];
  records?: RoundScoreRecord[];
}

export interface RoundScore {
  round: number;
  scores: PlayerScore[];
}

export interface PlayerScore {
  id: number;
  roundPoints: number;
  gamePoints: number;
}

export interface State {
  step: number;
  round: number;
  trick: Trick;
  activePlayerId: number;
  firstoutPlayerId: number;
  wish: number;
  players: PlayerState[];
  passedCards: PassedCard[];
  capturedCards: Card[];
}

export interface Trick {
  id: number;
  combos: Combo[];
}

export interface PassedCard {
  card: Card;
  /** Player Id of the passing player. */
  from: number;
  /** Player Id of the receiving player. */
  to: number;
  /** Was the passed card already accepted by the receiving player? */
  accepted: boolean;
}

export interface Combo {
  playerId: number;
  // empty means "pass"
  cards: Card[];
  points: number;
}

export interface PlayerState {
  player: Player;
  cards: Card[];
  bet: Bet;
  active: boolean;
  roundPoints: number;
  gamePoints: number;
}

export const betLookup: { [key: string]: Bet | undefined } = {
  "-2": Bet.INITIAL,
  "-1": Bet.NO_BET_YET,
  "0": Bet.NO_BET,
  "100": Bet.TICHU,
  "200": Bet.GRAND_TICHU,
};

const EMPTY_PLAYER: PlayerState = {
  player: {} as Player,
  cards: [],
  bet: Bet.INITIAL,
  active: false,
  roundPoints: 0,
  gamePoints: 0,
};

export const initialState: State = {
  step: 0,
  round: 0,
  trick: {
    id: 0,
    combos: [],
  },
  activePlayerId: 0,
  firstoutPlayerId: 0,
  wish: 0,
  players: [EMPTY_PLAYER, EMPTY_PLAYER, EMPTY_PLAYER, EMPTY_PLAYER],
  passedCards: [],
  capturedCards: [],
};

export class Model {
  private subject$ = new BehaviorSubject(initialState);

  public state$ = this.subject$.asObservable();

  public readonly trick$ = select(this.state$, (state) => state.trick);

  public readonly round$ = select(this.state$, (state) => state.round);

  public readonly wish$ = select(this.state$, (state) => state.wish);

  public readonly players$ = select(this.state$, (state) => state.players);

  public readonly playerIds$ = select(this.players$, (players) => players.map((p) => p.player.id));

  public readonly playerNames$ = select(this.players$, (players) =>
    players.map((p) => p.player.name),
  );

  public readonly passedCards$ = select(this.state$, (state) => state.passedCards);

  public readonly player$ = (playerId: number) =>
    select(this.state$, (state) => state.players.find((p) => p.player.id == playerId));

  public readonly latestCombo$ = (playerId: number) =>
    select(this.state$, (state) => state.trick.combos.findLast((c) => c.playerId == playerId));

  public readonly lastComboPlayer$ = select(this.state$, (state) => {
    const l = state.trick.combos.length;
    return state.trick.combos[l - 1]?.playerId;
  });

  getState() {
    return this.subject$.getValue();
  }

  setState(state: State) {
    this.subject$.next(state);
  }

  updateState(state: Partial<State>) {
    this.setState({ ...this.getState(), ...state });
  }

  init(players: Player[]) {
    if (players.length != 4) throw new Error("model requires 4 player ids");
    players = [...players].sort((p1, p2) => {
      const p1No = Number(p1.no) || 0;
      const p2No = Number(p2.no) || 0;
      return p1No - p2No;
    });
    this.updateState({
      step: 0,
      round: 1,
      trick: { id: 0, combos: [] },
      activePlayerId: 0,
      firstoutPlayerId: 0,
      wish: 0,
      players: players.map((p) => {
        const noNum = Number(p.no) || 0;
        const teamNum =
          p.team !== undefined && p.team !== null && p.team !== "" && !Number.isNaN(Number(p.team))
            ? Number(p.team)
            : (Math.max(1, noNum || 1) - 1) % 2;
        return {
          ...EMPTY_PLAYER,
          player: { ...p, id: Number(p.id), no: noNum, team: teamNum },
        };
      }),
      passedCards: [],
      capturedCards: [],
    });
  }

  private updatePlayerState(playerId: number, update: Partial<PlayerState>) {
    const players = this.getState().players.map((p) => {
      if (p.player.id != playerId) return p;
      return { ...p, ...update };
    });
    this.updateState({ players });
  }

  getPlayerIds() {
    return this.getState().players.map((p) => p.player.id);
  }

  getPlayerState(playerId: number) {
    const playerState = this.getState().players.find((p) => p.player.id == playerId);
    if (!playerState) throw new Error(`Could not find player state for player id ${playerId}.`);
    return playerState;
  }

  setWish(wish: number) {
    this.updateState({ wish });
  }

  mahjongWishGranted() {
    this.updateState({ wish: 0 });
  }

  dealCards(playerId: number, newCards: Card[]) {
    const playerState = this.getPlayerState(playerId);
    this.updatePlayerState(playerId, { cards: [...playerState.cards, ...newCards] });
  }

  bet(playerId: number, bet: Bet) {
    this.updatePlayerState(playerId, { bet });
  }

  pass(playerId: number) {
    this.playCombo(playerId, []);
  }

  acceptCards(playerId: number) {
    const passedCards = this.getState().passedCards.filter(
      (passedCard) => passedCard.to === playerId && !passedCard.accepted,
    );
    const cards = passedCards.map((passedCard) => passedCard.card);
    for (const card of cards) {
      this.acceptPassedCard(playerId, card);
    }
    this.dealCards(playerId, cards);
  }

  passCards(playerId: number, cardIds: string[]) {
    if (cardIds.length !== 3) throw new Error("3 cards must be passed");
    const nextId = this.nextPlayerId(playerId);
    const partnerId = this.nextPlayerId(nextId);
    const previousId = this.nextPlayerId(partnerId);
    this.addPassedCard(playerId, previousId, this.getCardById(playerId, cardIds[0]!)!);
    this.addPassedCard(playerId, partnerId, this.getCardById(playerId, cardIds[1]!)!);
    this.addPassedCard(playerId, nextId, this.getCardById(playerId, cardIds[2]!)!);
    this.removeCardsById(playerId, cardIds);
  }

  unpassCards(playerId: number, cardIds: string[]) {
    const idSet = new Set(cardIds.map((id) => String(id)));
    const allPassed = this.getState().passedCards;
    const retracted: Card[] = [];
    const remaining: PassedCard[] = [];
    for (const pc of allPassed) {
      if (
        pc.from === playerId &&
        !pc.accepted &&
        (idSet.size === 0 || idSet.has(String(pc.card.id)))
      ) {
        retracted.push(pc.card);
      } else {
        remaining.push(pc);
      }
    }
    if (retracted.length === 0) return;
    const playerState = this.getPlayerState(playerId);
    const existingIds = new Set(playerState.cards.map((c) => String(c.id)));
    const restored = retracted.filter((c) => !existingIds.has(String(c.id)));
    this.updateState({ passedCards: remaining });
    this.updatePlayerState(playerId, { cards: [...playerState.cards, ...restored] });
  }

  addPassedCard(from: number, to: number, card: Card) {
    const passedCards = [...this.getState().passedCards];
    passedCards.push({ from, to, card, accepted: false });
    this.updateState({ passedCards });
  }

  acceptPassedCard(to: number, card: Card) {
    const passedCards = [...this.getState().passedCards];
    const i = passedCards.findIndex((passedCard) => String(passedCard.card.id) === String(card.id));
    const updatedPassedCard: PassedCard = { ...passedCards[i]!, accepted: true };
    passedCards[i] = updatedPassedCard;
    this.updateState({ passedCards });
  }

  getCardById(playerId: number, cardId: string) {
    const playerState = this.getPlayerState(playerId);
    return playerState.cards.find((c) => String(c.id) === String(cardId));
  }

  removeCardsById(playerId: number, cardIds: string[]) {
    const normalizedIds = cardIds.map((id) => String(id));
    const playerState = this.getPlayerState(playerId);
    const cards = [...playerState.cards].filter((c) => !normalizedIds.includes(String(c.id)));
    this.updatePlayerState(playerId, { cards });
  }

  setActive(activePlayerIds: number[]) {
    for (const playerId of this.getPlayerIds()) {
      const active = activePlayerIds.includes(playerId);
      this.updatePlayerState(playerId, { active });
    }
  }

  playCombo(playerId: number, playedCards: Card[], points = 0) {
    // remove cards from player's hand
    const playerState = this.getPlayerState(playerId);
    const remainingCards = playerState.cards.filter((c) => {
      return (
        playedCards.find(
          (d) => String(c.type) === String(d.type) && String(c.type_arg) === String(d.type_arg),
        ) === undefined
      );
    });
    this.updatePlayerState(playerId, { cards: remainingCards });

    // add cards to trick
    const combo = { playerId, cards: playedCards, points };
    const combos = [...this.getState().trick.combos];
    combos.push(combo);
    const trick = { ...this.getState().trick, combos };
    this.updateState({ trick });

    this.updateState({ activePlayerId: this.nextPlayerId(playerId) });
  }

  nextPlayerId(playerId: number) {
    const player = this.getPlayerState(playerId);
    const nextPlayerState = this.getState().players.find(
      (p) => Number(p.player.no) % 4 == (Number(player.player.no) + 1) % 4,
    );
    return nextPlayerState!.player.id;
  }

  setBet(playerId: number, bet: Bet) {
    this.updatePlayerState(playerId, { bet });
  }

  setGamePoints(playerId: number, gamePoints: number) {
    this.updatePlayerState(playerId, { gamePoints });
  }

  beginNewRound() {
    const playerIds = this.getPlayerIds();
    for (const playerId of playerIds) {
      this.updatePlayerState(playerId, {
        cards: [],
        bet: Bet.INITIAL,
        active: false,
        roundPoints: 0,
      });
    }
    this.updateState({
      round: this.getState().round + 1,
      trick: { id: 0, combos: [] },
      activePlayerId: 0,
      firstoutPlayerId: 0,
      wish: 0,
      passedCards: [],
      capturedCards: [],
    });
  }

  captureCards(playerId: number, trickValue: number) {
    const player = this.getPlayerState(playerId);
    const roundPoints = player.roundPoints + trickValue;
    this.updatePlayerState(playerId, { roundPoints });

    const currentTrick = this.getState().trick;
    const trickCards = currentTrick.combos.flatMap((c) => c.cards);
    const capturedCards = [...this.getState().capturedCards, ...trickCards];
    const trick: Trick = { id: currentTrick.id + 1, combos: [] };
    this.updateState({ trick, capturedCards });
  }
}
