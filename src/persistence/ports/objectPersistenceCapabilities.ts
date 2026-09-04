import type { ObjectReadPort } from "./objectReadPort";
import type { ObjectRecoveryPort } from "./objectRecoveryPort";
import type { ObjectTransferPort } from "./objectTransferPort";
import type { ObjectWritePort } from "./objectWritePort";

/**
 * Nach Fähigkeiten getrennte Application-facing Persistence-Abhängigkeiten.
 */
export type ObjectPersistenceCapabilities = {
	read: ObjectReadPort;
	write: ObjectWritePort;
	transfer: ObjectTransferPort;
	recovery: ObjectRecoveryPort;
};
