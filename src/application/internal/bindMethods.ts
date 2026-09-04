import { ApplicationInvariantError } from "../applicationError";

/** Bindet ausschließlich die explizit veröffentlichte Methodenmenge. */
export function bindMethods<T extends object, K extends keyof T>(
	target: T,
	methods: readonly K[],
): Pick<T, K> {
	return Object.fromEntries(
		methods.map((method) => {
			const candidate = target[method];
			if (typeof candidate !== "function")
				throw new ApplicationInvariantError(
					`Application-Methode "${String(method)}" fehlt.`,
				);
			return [method, candidate.bind(target)];
		}),
	) as Pick<T, K>;
}
