import { describe, expect, it } from "vitest";
import { Player } from "../src/domain/models";
import {
	getPlayerIdAtSeat,
	getSeatEntries,
	getSeatNumber,
	movePlayerToSeat as movePlayer,
	replaceSeatOrder as replaceOrder,
	type SeatOrderOptions,
	shufflePlayers as shuffle,
	swapSeats as swap,
	validateSeatOrderIntegrity,
} from "../src/domain/seatOrder";
import { fixedDomainServices } from "./fixedClock";
import { createTestGame } from "./fixtures";

const movePlayerToSeat = (
	game: Parameters<typeof movePlayer>[0],
	playerId: string,
	seat: number,
	options: SeatOrderOptions = {},
) => movePlayer(game, playerId, seat, fixedDomainServices, options);
const swapSeats = (
	game: Parameters<typeof swap>[0],
	seatA: number,
	seatB: number,
	options: SeatOrderOptions = {},
) => swap(game, seatA, seatB, fixedDomainServices, options);
const replaceSeatOrder = (
	game: Parameters<typeof replaceOrder>[0],
	order: string[],
	options: SeatOrderOptions = {},
) => replaceOrder(game, order, fixedDomainServices, options);
const shufflePlayers = (
	game: Parameters<typeof shuffle>[0],
	rng: () => number,
) => shuffle(game, fixedDomainServices, { rng });

describe("Sitzordnung", () => {
	it("verschiebt und tauscht Spieler mit einsbasierten Sitznummern", () => {
		const game = createTestGame(4);
		const moved = movePlayerToSeat(game, "p_player4", 2);
		const swapped = swapSeats(moved, 1, 3);

		expect(moved.seatOrder).toEqual([
			"p_player1",
			"p_player4",
			"p_player2",
			"p_player3",
		]);
		expect(swapped.seatOrder).toEqual([
			"p_player2",
			"p_player4",
			"p_player1",
			"p_player3",
		]);
		expect(getSeatNumber(swapped, "p_player4")).toBe(2);
		expect(getPlayerIdAtSeat(swapped, 3)).toBe("p_player1");
	});

	it("lässt den ursprünglichen Spielstand unverändert", () => {
		const game = createTestGame(4);
		movePlayerToSeat(game, "p_player4", 2);

		expect(game.seatOrder).toEqual([
			"p_player1",
			"p_player2",
			"p_player3",
			"p_player4",
		]);
		expect(game.log).toHaveLength(0);
	});

	it("ersetzt einen leeren Zielsitz und macht den alten Sitz frei", () => {
		const game = createTestGame(3);
		game.seatOrder = ["p_player1", "p_player2", "p_empty", "p_player3"];

		const moved = movePlayerToSeat(game, "p_player1", 3);

		expect(moved.seatOrder).toEqual([
			"p_empty",
			"p_player2",
			"p_player1",
			"p_player3",
		]);
	});

	it("lehnt ungültige Sitznummern ab", () => {
		const game = createTestGame(4);
		expect(() => getPlayerIdAtSeat(game, 0)).toThrow(/Sitznummer/);
		expect(() => swapSeats(game, 1, 5)).toThrow(/Sitznummer/);
	});

	it("erlaubt mehrere freie Plätze ohne zugehöriges Player-Objekt", () => {
		const game = createTestGame(2);
		game.seatOrder = ["p_empty", "p_player1", "p_empty", "p_player2"];

		expect(() => validateSeatOrderIntegrity(game)).not.toThrow();
		expect(getPlayerIdAtSeat(game, 3)).toBe("p_empty");
		expect(getSeatEntries(game)).toEqual([
			{ seatNumber: 1, playerId: "p_empty", playerName: "" },
			{ seatNumber: 2, playerId: "p_player1", playerName: "Player 1" },
			{ seatNumber: 3, playerId: "p_empty", playerName: "" },
			{ seatNumber: 4, playerId: "p_player2", playerName: "Player 2" },
		]);
		expect(
			replaceSeatOrder(game, ["p_player1", "p_empty", "p_empty", "p_player2"])
				.seatOrder,
		).toEqual(["p_player1", "p_empty", "p_empty", "p_player2"]);
	});

	it("ordnet echte Spieler zufällig an und lässt freie Sitzplätze stehen", () => {
		const game = createTestGame(3);
		game.seatOrder = [
			"p_empty",
			"p_player1",
			"p_empty",
			"p_player2",
			"p_player3",
		];

		const shuffled = shufflePlayers(game, () => 0);

		expect(shuffled.seatOrder).toEqual([
			"p_empty",
			"p_player2",
			"p_empty",
			"p_player3",
			"p_player1",
		]);
		expect(game.seatOrder).toEqual([
			"p_empty",
			"p_player1",
			"p_empty",
			"p_player2",
			"p_player3",
		]);
		expect(shuffled.log.at(-1)).toMatchObject({
			type: "seat_order_changed",
			payload: { action: "shuffle" },
		});
	});

	it("lehnt eine ungültige Zufallszahl ab", () => {
		expect(() => shufflePlayers(createTestGame(2), () => 1)).toThrow(
			/0 <= x < 1/,
		);
	});

	it("lehnt ein tatsächliches Player-Objekt mit der reservierten ID ab", () => {
		const game = createTestGame(1);
		game.playersById.p_empty = new Player({
			id: "p_empty",
			name: "Kein leerer Platz",
		});

		expect(() => validateSeatOrderIntegrity(game)).toThrow(/reservierte ID/);
	});
});
