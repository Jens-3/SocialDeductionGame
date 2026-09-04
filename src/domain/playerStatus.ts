import type { PlayerStatus } from "./models";

export function isPlayerStatusActiveAtNight(
	status: PlayerStatus,
	night: number,
): boolean {
	return (
		night >= status.fromNight &&
		(status.untilNight === null || night <= status.untilNight)
	);
}
