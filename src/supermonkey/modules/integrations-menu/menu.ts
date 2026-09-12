import { IntegrationsMenu as IntegrationsMenuOverlay } from "../../integrations/menu/integrations-menu";
import { Action } from "../configuration/action";
import type { Configuration } from "../configuration/configuration";
import { Module, type ModuleOpts } from "../module";

/**
 * Static module that exposes a Configuration Menu action to open the integrations registry.
 */
export class IntegrationsMenu extends Module {
    private readonly openAction: Action;

    constructor(name: string, opts: ModuleOpts = {}) {
        super(name, opts);
        this.openAction = new Action(
            this.name,
            "open",
            async () => {
                this.openOverlay();
            },
            {
                label: "Open integrations",
                description: "Opens the effective integrations registry.",
            },
        );
    }

    override get title(): string {
        return "Integrations Menu";
    }

    override get description(): string {
        return "The integrations menu lists the effective registry.";
    }

    override get configurations(): Configuration[] {
        return [this.openAction];
    }

    private openOverlay(): void {
        IntegrationsMenuOverlay.open();
    }
}
