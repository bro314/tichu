import { BehaviorSubject } from "rxjs";
import { select } from "./utils";

export interface ScoreBoard {
  rounds: RoundScore[];
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

export interface Card {
  // random number 1-56, different in each game
  id: string;
  // 1-4
  // 1: black (or dragon)
  // 2: red (or phoenix)
  // 3: blue (or dog)
  // 4: green (or mahjong)
  type: string;
  // 1-14
  // 1 are special cards, 14 is ace, 11-13 are J,Q,K
  type_arg: string;
}

export enum Bet {
  // Player can still make a Grand Tichu bet.
  INITIAL = "-2",
  // Player can still make a Tichu bet.
  NO_BET_YET = "-1",
  // Player cannot bet anymore.
  NO_BET = "0",
  TICHU = "100",
  GRAND_TICHU = "200",
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
    players.map((p) => p.player.name)
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
    players = players.sort((p1, p2) => {
      const p1No = Number(p1.no) ?? 0;
      const p2No = Number(p2.no) ?? 0;
      return p1No - p2No;
    });
    this.updateState({
      round: 1,
      players: players.map((p) => ({
        ...EMPTY_PLAYER,
        player: p,
      })),
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
      (passedCard) => passedCard.to === playerId
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

  addPassedCard(from: number, to: number, card: Card) {
    const passedCards = [...this.getState().passedCards];
    passedCards.push({ from, to, card, accepted: false });
    this.updateState({ passedCards });
  }

  acceptPassedCard(to: number, card: Card) {
    const passedCards = [...this.getState().passedCards];
    const i = passedCards.findIndex((passedCard) => passedCard.card.id === card.id);
    const updatedPassedCard: PassedCard = { ...passedCards[i]!, accepted: true };
    passedCards[i] = updatedPassedCard;
    this.updateState({ passedCards });
  }

  getCardById(playerId: number, cardId: string) {
    const playerState = this.getPlayerState(playerId);
    return playerState.cards.find((c) => c.id === cardId);
  }

  removeCardsById(playerId: number, cardIds: string[]) {
    const playerState = this.getPlayerState(playerId);
    const cards = [...playerState.cards].filter((c) => !cardIds.includes(c.id));
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
      return playedCards.find((d) => c.type === d.type && c.type_arg === d.type_arg) === undefined;
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
      (p) => Number(p.player.no) % 4 == (Number(player.player.no) + 1) % 4
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
    });
  }

  captureCards(playerId: number, trickValue: number) {
    const player = this.getPlayerState(playerId);
    const roundPoints = player.roundPoints + trickValue;
    this.updatePlayerState(playerId, { roundPoints });

    const currentTrick = this.getState().trick;
    const trick: Trick = { id: currentTrick.id + 1, combos: [] };
    this.updateState({ trick });
  }
}

// prettier-ignore
interface NotifTypes {
  "wishMade": { wish: number };
  "mahjongWishGranted": {};
  "dealCards": { cards: Card[] };
  "grandTichuBet": { bet: number; player_id: number };
  "tichuBet": { bet: number; player_id: number };
  "confirmTichu": { grand: boolean; msg: string };
  "playCombo": { cards: Card[]; player_id: number; combo_name: string; points: number };
  "playerGoOut": { firstout_id: number; player_id: number };
  "pass": { player_id: number };
  "captureCards": { player_id: number; trick_value: number };
  "newScores": { newScores: { [key: number]: number } };
  "autopass": { autopass: string };
  "acceptCards": { cards: Card[] };
  "passCards": { cardIds: string[] };
  "devConsole": { msg: string };
}
