import { GM_openInTab, GM_registerMenuCommand } from "$";
import { DOCS_HOME_URL, SCRIPT_FULL_NAME } from "../../../constants";
import { SuperMonkey } from "../../../supermonkey";
import { createElement, injectElement } from "../../../utils/dom/elements";
import { injectInputRow, injectPanel, injectSection } from "../../../utils/ui/ui-builder";
import { Logger } from "../../../utils/logger";
import { ID_SEPARATOR } from "../../../utils/string";
import { Module, type ModuleOpts } from "../../module";
import { NotificationEntry } from "../../notification-bar/entries/notification-entry";
import type { Configuration } from "../configuration";
import icon from "./application-x-executable-svgrepo-com.svg?raw";
import css from "./configuration-menu.css?raw";
import { buildConfigurationInput } from "./input-builder";

const USERSCRIPT_MENU_COMMAND = `Toggle ${SCRIPT_FULL_NAME} configuration`;

class ConfigurationMenuEntry extends NotificationEntry {
    private readonly log: Logger = new Logger("ConfigurationMenuEntry");

    constructor(private readonly integrationName: string) {
        super(icon, { css: [css] });
    }

    /**
     * Toggles the configuration panel from a userscript menu command.
     * When opening, re-appends the Notification Bar host so the panel can sit above covering page UI.
     */
    toggleFromUserscriptMenu(): void {
        const opened = this.toggleMenuOpen();
        if (opened) {
            this.bringNotificationHostToFront();
        }
    }

    protected override buildMenuContainer(): HTMLElement | null {
        const subtitle = createElement("div");
        injectElement(subtitle, "h2", {
            innerText: `Integration: ${this.integrationName}`,
        });

        const panel = injectPanel(document.body, {
            title: `${SCRIPT_FULL_NAME} Configuration`,
            subtitle,
            button: {
                label: "Help",
                onClick: () => {
                    GM_openInTab(DOCS_HOME_URL, { active: true });
                },
            },
        });

        this.injectModulesConfigurations(panel);

        return panel;
    }

    private bringNotificationHostToFront(): void {
        const menu = this.menuContainer;
        if (menu == null) {
            return;
        }

        const root = menu.getRootNode();
        if (!(root instanceof ShadowRoot)) {
            return;
        }

        const host = root.host;
        if (!(host instanceof HTMLElement)) {
            return;
        }

        host.style.zIndex = "2147483647";
        document.body?.appendChild(host);
    }

    private injectModulesConfigurations(section: HTMLElement): void {
        const modules = Array.from(SuperMonkey.loadedIntegration?.modules?.values() ?? [])
            .filter((module: Module) => module.configurations.length > 0);

        this.log.debug("Found", modules.length, "module(s) with configurations.");

        for (const module of modules) {
            this.buildBlockForModule(module, section);
        }
    }

    private buildBlockForModule(module: Module, section: HTMLElement): void {
        const moduleSection = injectSection(section, {
            title: module.title,
            subtitle: module.description,
        });

        for (const configuration of module.configurations) {
            this.injectConfiguration(moduleSection, configuration);
        }
    }

    private injectConfiguration(moduleContainer: HTMLElement, configuration: Configuration): void {
        const { input, help } = buildConfigurationInput(configuration);

        injectInputRow(
            moduleContainer,
            configuration.key,
            configuration.opts?.label ?? configuration.key,
            input,
            help,
        );
    }
}

/**
 * Static module that exposes the gear icon and settings panel on the Notification Bar.
 */
export class ConfigurationMenu extends Module {
    private readonly menuEntry: ConfigurationMenuEntry;

    constructor(name: string, opts: ModuleOpts = {}) {
        super(name, opts);
        this.menuEntry = new ConfigurationMenuEntry(name.split(ID_SEPARATOR)[0] ?? name);
    }

    override get title(): string {
        return "Configuration Menu";
    }

    override get description(): string {
        return "The configuration menu displays the configurations for the modules.";
    }

    override get notifications(): NotificationEntry[] {
        return [this.menuEntry];
    }

    protected override async onIntegrationLoaded(): Promise<void> {
        this.registerUserscriptMenuCommand();
    }

    private registerUserscriptMenuCommand(): void {
        GM_registerMenuCommand(USERSCRIPT_MENU_COMMAND, () => {
            this.menuEntry.toggleFromUserscriptMenu();
        });
    }
}
