export class PlatformOperationError extends Error {
	readonly source = "platform";

	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "PlatformOperationError";
	}
}
