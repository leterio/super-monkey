import { getValue, setValue } from "../../utils/value";
import { Logger } from "../../utils/logger";
import { isPlainObject } from "../../utils/type";
import { Integration } from "../metadata";

export const USER_INTEGRATIONS_STORAGE_KEY = "superMonkeyUserIntegrations";

/** User-defined integrations persisted in Tampermonkey storage. */
export class UserIntegrationsStore {
    private static readonly log: Logger = new Logger("UserIntegrationsStore");

    private constructor() { }

    static loadAll(): Record<string, unknown> {
        this.log.debug("Loading stored integrations ...");

        const raw = getValue(USER_INTEGRATIONS_STORAGE_KEY, {});
        if (!isPlainObject(raw) || Object.keys(raw).length === 0) {
            this.log.debug("Stored integrations are empty");
            return {};
        }

        this.log.debug("Stored integrations loaded", ...Object.keys(raw).map((name) => `"${name}"`));

        return { ...raw };
    }

    static put(integration: Integration): void {
        this.log.debug("Upserting integration", integration.name);
        const map = this.loadAll();
        map[integration.name] = structuredClone(integration);
        this.saveAll(map);
    }

    static remove(name: string): boolean {
        const map = this.loadAll();
        if (!(name in map)) {
            return false;
        }

        delete map[name];
        this.saveAll(map);
        return true;
    }

    static has(name: string): boolean {
        return name in this.loadAll();
    }

    private static saveAll(map: Record<string, unknown>): void {
        setValue(USER_INTEGRATIONS_STORAGE_KEY, map);
    }
}
