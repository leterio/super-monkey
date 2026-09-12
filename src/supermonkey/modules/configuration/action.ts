import type { ConfigurationOpts } from "./configuration";

export type ActionOpts = ConfigurationOpts;

/**
 * Click action with no stored value.
 */
export class Action {
    constructor(
        readonly moduleName: string,
        readonly key: string,
        readonly handler: () => Promise<void>,
        readonly opts: ActionOpts,
    ) { }
}
