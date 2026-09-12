import { GM_openInTab, GM_registerMenuCommand } from "$";
import { DOCS_INTEGRATIONS_MENU_URL } from "../../constants";
import { SuperMonkey } from "../../supermonkey";
import { createElement, injectElement } from "../../utils/dom/elements";
import { attachShadowRoot } from "../../utils/dom/shadow";
import { Logger, LogLevel } from "../../utils/logger";
import {
    CSS_RESET,
    GENERAL_CSS,
    UICSSMap,
    injectBackdrop,
    injectInputRow,
    injectPanel,
    injectSection,
} from "../../utils/ui/ui-builder";
import {
    confirmBeforeKeyCleanup,
    integrationHasConfigKeys,
    moduleInstanceNames,
    planModuleConfigPurge,
    purgeAllIntegrationConfigs,
    purgeRemovedModuleConfigs,
} from "../editor/integration-config-cleanup";
import { IntegrationEditorModal } from "../editor/integration-editor-modal";
import { IntegrationTransfer } from "../editor/integration-transfer";
import { IntegrationProvenance, IntegrationsRegistry } from "../integrations-registry";
import { Integration } from "../metadata";
import css from "./integrations-menu.css?raw";

enum CSSMap {
    BASE_CLASS = "sm-int-menu",
    LIST_CLASS = "list",
    ROW_ITEM_CLASS = "row-item",
    ROW_NAME_CLASS = "row-name",
    ROW_BADGES_CLASS = "row-badges",
    ROW_ACTIONS_CLASS = "row-actions",
    BADGE_CLASS = "badge",
    BADGE_ACTIVE_CLASS = "badge-active",
    EMPTY_CLASS = "empty",
    FOOTER_CLASS = "footer",
    FOOTER_ACTIONS_CLASS = "footer-actions",
    LOG_LEVEL_CLASS = "log-level",
}

const LOG_LEVEL_OPTIONS: ReadonlyArray<{ readonly value: LogLevel; readonly label: string }> = [
    { value: LogLevel.TRACE, label: "TRACE" },
    { value: LogLevel.DEBUG, label: "DEBUG" },
    { value: LogLevel.INFO, label: "INFO" },
    { value: LogLevel.WARN, label: "WARN" },
    { value: LogLevel.ERROR, label: "ERROR" },
    { value: LogLevel.FATAL, label: "FATAL" },
];

const LOG_LEVEL_HELP =
    "Tampermonkey <code>logLevel</code> (0 TRACE … 5 FATAL). Applies immediately.";

/**
 * In-page list of the effective integration registry with create/edit/import/share actions.
 * Registers a Tampermonkey command.
 */
export class IntegrationsMenu {
    private static menuRoot?: HTMLElement;

    static registerMenuCommands(): void {
        GM_registerMenuCommand("Open Integrations Menu", () => {
            this.open();
        });
    }

    /** Shows the integrations list overlay. */
    static open(): void {
        if (document.body == null) {
            return;
        }

        if (this.menuRoot != null) {
            document.body.appendChild(this.menuRoot);
            return;
        }

        this.buildMenu();
    }

    private static close(): void {
        this.menuRoot?.remove();
        this.menuRoot = undefined;
    }

    private static buildMenu(): void {
        this.menuRoot = injectElement(document.body, "div");
        const shadow = attachShadowRoot(this.menuRoot, {
            mode: "closed",
            css: [CSS_RESET, GENERAL_CSS, css],
        });
        injectBackdrop(shadow, () => this.close());
        const panel = injectPanel(shadow, {
            title: "Integrations",
            classes: [CSSMap.BASE_CLASS],
            button: {
                label: "Help",
                onClick: () => {
                    GM_openInTab(DOCS_INTEGRATIONS_MENU_URL, { active: true });
                },
            },
            closeHandler: () => this.close(),
        });

        const list = injectSection(panel, { classes: [CSSMap.LIST_CLASS] });
        this.renderList(list);

        const footer = injectSection(panel, { classes: [CSSMap.FOOTER_CLASS] });
        this.renderLogLevelControl(footer);
        const actions = injectElement(footer, "div", {
            classList: [UICSSMap.ROW_CLASS, CSSMap.FOOTER_ACTIONS_CLASS],
        });
        this.button(actions, "Create", () => {
            this.close();
            IntegrationEditorModal.openCreate();
        }, [UICSSMap.BUTTON_PRIMARY_CLASS]);
        this.button(actions, "Import", () => {
            void IntegrationTransfer.import();
        });
    }

    private static renderLogLevelControl(parent: HTMLElement): void {
        const select = createElement("select");
        for (const option of LOG_LEVEL_OPTIONS) {
            injectElement(select, "option", {
                value: String(option.value),
                innerText: option.label,
            });
        }
        select.value = String(Logger.logLevel);

        select.addEventListener("change", () => {
            const next = Number(select.value);
            if (!Number.isFinite(next)) {
                return;
            }
            Logger.setLevel(next as LogLevel);
        });

        injectInputRow(
            parent,
            "sm-int-log-level",
            "Log level",
            select,
            LOG_LEVEL_HELP,
            UICSSMap.ROW_CLASS,
        );
        select.closest("section")?.classList.add(CSSMap.LOG_LEVEL_CLASS);
    }

    private static renderList(list: HTMLElement): void {
        const activeName = SuperMonkey.loadedIntegration?.name;
        const integrations = [...IntegrationsRegistry.getEffective()]
            .sort((a, b) => {
                if (activeName != null) {
                    if (a.name === activeName) {
                        return -1;
                    }
                    if (b.name === activeName) {
                        return 1;
                    }
                }
                return a.name.localeCompare(b.name);
            });

        if (integrations.length === 0) {
            injectElement(list, "p", {
                classList: [CSSMap.EMPTY_CLASS],
                innerText: "No integrations in the effective registry.",
            });
            return;
        }

        for (const integration of integrations) {
            this.renderRow(list, integration, activeName);
        }
    }

    private static renderRow(
        list: HTMLElement,
        integration: Integration,
        activeName: string | undefined,
    ): void {
        const provenance: IntegrationProvenance =
            IntegrationsRegistry.getProvenance(integration.name) ?? "user";
        const row = injectSection(list, { classes: [UICSSMap.ROW_CLASS, CSSMap.ROW_ITEM_CLASS] });

        injectElement(row, "span", {
            classList: [CSSMap.ROW_NAME_CLASS],
            innerText: integration.name,
        });

        const badges = injectElement(row, "div", {
            classList: [UICSSMap.ROW_CLASS, CSSMap.ROW_BADGES_CLASS],
        });
        injectElement(badges, "span", {
            classList: [CSSMap.BADGE_CLASS],
            innerText: provenance,
        });
        if (activeName != null && integration.name === activeName) {
            injectElement(badges, "span", {
                classList: [CSSMap.BADGE_CLASS, CSSMap.BADGE_ACTIVE_CLASS],
                innerText: "active",
            });
        }

        const actions = injectElement(row, "div", {
            classList: [UICSSMap.ROW_CLASS, CSSMap.ROW_ACTIONS_CLASS],
        });
        this.button(actions, "Edit", () => {
            this.close();
            IntegrationEditorModal.openEdit(integration);
        });
        this.button(actions, "Share", () => {
            IntegrationTransfer.export(integration);
        });

        if (provenance === "user") {
            this.button(actions, "Delete", () => {
                this.onDelete(integration.name);
            }, [UICSSMap.BUTTON_DANGER_CLASS]);
        } else if (provenance === "override") {
            this.button(actions, "Reset", () => {
                this.onReset(integration.name);
            }, [UICSSMap.BUTTON_DANGER_CLASS]);
        }
    }

    private static onDelete(name: string): void {
        if (!confirmBeforeKeyCleanup(name, {
            modulesToPurge: [],
            purgeAllIntegrationConfigs: integrationHasConfigKeys(name),
        }, `Delete integration "${name}"?`)) {
            return;
        }

        IntegrationsRegistry.removeStored(name);
        purgeAllIntegrationConfigs(name);
        this.finishMutation();
    }

    private static onReset(name: string): void {
        const stored = IntegrationsRegistry.getStoredMap()[name];
        const builtin = IntegrationsRegistry.getBuiltins().find((integration) => integration.name === name);
        const plan = planModuleConfigPurge(
            name,
            moduleInstanceNames(stored),
            moduleInstanceNames(builtin),
        );
        if (!confirmBeforeKeyCleanup(name, {
            modulesToPurge: plan.modulesToPurge,
            purgeAllIntegrationConfigs: false,
        }, `Restore "${name}" to the built-in definition?`)) {
            return;
        }

        IntegrationsRegistry.removeStored(name);
        purgeRemovedModuleConfigs(name, plan.modulesToPurge);
        this.finishMutation();
    }

    private static finishMutation(): void {
        this.close();
        alert("Reload the page to apply the changes.");
    }

    private static button(
        parent: HTMLElement,
        label: string,
        onClick: () => void,
        extraClasses: string[] = [],
    ): void {
        injectElement(parent, "button", {
            type: "button",
            innerText: label,
            classList: [UICSSMap.BUTTON_CLASS, ...extraClasses],
        }, { click: onClick });
    }
}
