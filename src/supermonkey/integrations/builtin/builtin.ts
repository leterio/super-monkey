import { Integration } from "../metadata";
import { REDDIT_COM_INTEGRATION } from "./reddit_com";

/** Built-in integrations shipped with the script. */
export class BuiltinIntegrations {
    private static readonly INTEGRATIONS: Integration[] = [
        REDDIT_COM_INTEGRATION,
    ];

    /** Returns the built-in integration registry in declaration order. */
    static getIntegrations(): Integration[] {
        return this.INTEGRATIONS;
    }

    private constructor() { }
}
