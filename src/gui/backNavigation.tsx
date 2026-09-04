import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useRef,
} from "react";
import type { ApplicationLifecyclePort } from "../application/ports/applicationLifecyclePort";

type BackHandler = () => void;
type BackRegistration = { id: number; priority: number; handler: BackHandler };

const BackNavigationContext = createContext<
	{ register(handler: BackHandler, priority: number): () => void } | undefined
>(undefined);

export function BackNavigationProvider({
	children,
	applicationLifecycle,
}: {
	children: ReactNode;
	applicationLifecycle?: ApplicationLifecyclePort;
}) {
	const registrationsRef = useRef<BackRegistration[]>([]);
	const nextIdRef = useRef(1);
	const register = useCallback((handler: BackHandler, priority: number) => {
		const registration = { id: nextIdRef.current++, priority, handler };
		registrationsRef.current.push(registration);
		return () => {
			registrationsRef.current = registrationsRef.current.filter(
				(entry) => entry.id !== registration.id,
			);
		};
	}, []);

	useEffect(() => {
		if (!applicationLifecycle?.isNativePlatform()) return;
		let active = true;
		let removeListener: (() => void) | undefined;
		void applicationLifecycle
			.addBackButtonListener(() => {
				const selected = [...registrationsRef.current].sort(
					(left, right) => right.priority - left.priority || right.id - left.id,
				)[0];
				selected?.handler();
			})
			.then((remove) => {
				if (active) removeListener = remove;
				else remove();
			});
		return () => {
			active = false;
			removeListener?.();
		};
	}, [applicationLifecycle]);

	return (
		<BackNavigationContext value={{ register }}>
			{children}
		</BackNavigationContext>
	);
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook und Provider teilen bewusst denselben privaten Kontext.
export function useBackHandler(
	handler: BackHandler,
	enabled = true,
	priority = 10,
): void {
	const context = use(BackNavigationContext);
	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	}, [handler]);
	useEffect(() => {
		if (!context || !enabled) return;
		return context.register(() => handlerRef.current(), priority);
	}, [context, enabled, priority]);
}
