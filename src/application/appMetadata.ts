import {
	author,
	license,
	appMetadata as packageAppMetadata,
	version,
} from "../../package.json";

export const appMetadata = Object.freeze({
	version,
	author,
	licenseSpdx: license,
	softwareLicenseName: packageAppMetadata.softwareLicenseName,
	copyrightYears: packageAppMetadata.copyrightYears,
	copyrightNotice: `Copyright © ${packageAppMetadata.copyrightYears} ${author}`,
});
