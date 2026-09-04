/** Von der Domain benötigte, injizierbare Quelle für neue undurchsichtige IDs. */
export interface IdGenerator {
	createId(prefix: string): string;
}
