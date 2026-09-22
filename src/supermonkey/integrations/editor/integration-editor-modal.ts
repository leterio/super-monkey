import { GM_openInTab } from "$";
import { DOCS_INTEGRATION_EDITOR_URL } from "../../constants";
import { injectElement } from "../../utils/dom/elements";
import { Logger } from "../../utils/logger";
import { normalizeId } from "../../utils/string";
import {
    createIsolatedFrame,
    injectBackdrop,
    injectPanel,
    injectSection,
    type IsolatedFrame,
    UICSSMap,
} from "../../utils/ui/ui-builder";
import { IntegrationValidationIssue, validateIntegration } from "../integration-validation";
import { IntegrationProvenance, IntegrationsRegistry } from "../integrations-registry";
import { Integration } from "../metadata";
import {
    DraftIntegration,
    draftToIntegration,
    integrationToDraft,
} from "./draft-mappers";
import { EditorSectionContext } from "./editor-section";
import { EditorSectionRegistry } from "./editor-section-registry";
import {
    createEditorUiHelpers,
    EditorUiHelpers,
} from "./editor-ui-helpers";
import {
    applyModuleConfigRenames,
    confirmBeforeKeyCleanup,
    integrationHasConfigKeys,
    moduleInstanceNames,
    planEditorModuleConfigChanges,
    planModuleConfigPurge,
    purgeAllIntegrationConfigs,
    purgeRemovedModuleConfigs,
} from "./integration-config-cleanup";
import {
    applyIssueHighlights,
    focusIssueTarget,
} from "./editor-issue-highlight";
import { IntegrationTransfer } from "./integration-transfer";
import css from "./integration-editor.css?raw";
import "./sections/register-builtin-sections";

type EditorMode = "create" | "edit";

enum CSSMap {
    BASE_CLASS = "sm-ite-panel",
    BODY_CLASS = "body",
    ERRORS_CLASS = "errors",
    FOOTER_CLASS = "footer",
    FOOTER_LEFT_CLASS = "footer-left",
    FOOTER_RIGHT_CLASS = "footer-right",
}

export class IntegrationEditorModal {
    private static readonly log = new Logger("IntegrationEditorModal");
    private static openInstance: IntegrationEditorModal | null = null;

    private frame: IsolatedFrame | null = null;
    private bodyEl: HTMLElement | null = null;
    private errorsEl: HTMLElement | null = null;
    private ui: EditorUiHelpers | null = null;
    private readonly sectionHosts = new Map<string, HTMLElement>();

    private constructor(
        private readonly mode: EditorMode,
        private readonly draft: DraftIntegration,
        private readonly provenance?: IntegrationProvenance,
        private readonly initialIssues: IntegrationValidationIssue[] = [],
    ) { }

    static openCreate(): void {
        const hostname = window.location.hostname || "example.com";
        const draft = integrationToDraft({
            name: normalizeId(hostname),
            matchedDomains: [hostname],
        });
        this.open(new IntegrationEditorModal("create", draft));
    }

    static openCreateFromImport(
        draft: DraftIntegration,
        issues: IntegrationValidationIssue[],
    ): void {
        this.open(new IntegrationEditorModal("create", draft, undefined, issues));
    }

    static openEdit(integration: Integration): void {
        this.open(new IntegrationEditorModal(
            "edit",
            integrationToDraft(integration),
            IntegrationsRegistry.getProvenance(integration.name),
        ));
    }

    static closeOpen(): void {
        this.openInstance?.close();
    }

    private static open(instance: IntegrationEditorModal): void {
        this.openInstance?.close();
        this.openInstance = instance;
        instance.mount();
    }

    private mount(): void {
        this.frame = createIsolatedFrame(css);

        injectBackdrop(this.frame.body, () => this.close());
        const panel = injectPanel(this.frame.body, {
            title: this.mode === "create" ? "Create integration" : `Editing ${this.draft.name}`,
            classes: [CSSMap.BASE_CLASS],
            button: {
                label: "Help",
                onClick: () => {
                    GM_openInTab(DOCS_INTEGRATION_EDITOR_URL, { active: true });
                },
            },
            closeHandler: () => this.close(),
        });
        const body = injectSection(panel, { classes: [CSSMap.BODY_CLASS] });
        this.bodyEl = body;
        this.ui = createEditorUiHelpers();
        this.mountSections();

        this.errorsEl = injectSection(panel, { classes: [CSSMap.ERRORS_CLASS] });
        this.errorsEl.hidden = true;
        this.buildFooter(panel);
        if (this.initialIssues.length > 0) {
            this.showIssues(this.initialIssues);
        }
    }

    private mountSections(sectionId?: string): void {
        if (this.bodyEl == null || this.ui == null) {
            return;
        }

        if (sectionId == null) {
            this.bodyEl.replaceChildren();
            this.sectionHosts.clear();
            for (const section of EditorSectionRegistry.getSections()) {
                this.mountOneSection(section.id);
            }
            return;
        }

        this.mountOneSection(sectionId);
    }

    private mountOneSection(sectionId: string): void {
        if (this.bodyEl == null || this.ui == null) {
            return;
        }

        const section = EditorSectionRegistry.getSection(sectionId);
        if (section == null) {
            return;
        }

        const visibilityCtx = { mode: this.mode, draft: this.draft };
        if (section.visible?.(visibilityCtx) === false) {
            const existing = this.sectionHosts.get(sectionId);
            existing?.remove();
            this.sectionHosts.delete(sectionId);
            return;
        }

        let host = this.sectionHosts.get(sectionId);
        if (host == null) {
            host = document.createElement("div");
            host.dataset.editorSection = sectionId;
            this.insertSectionHost(host, section.id);
            this.sectionHosts.set(sectionId, host);
        } else {
            host.replaceChildren();
        }

        const ctx: EditorSectionContext = {
            mode: this.mode,
            draft: this.draft,
            body: host,
            ui: this.ui,
            requestRerender: (id) => this.mountSections(id),
        };
        section.mount(ctx);
    }

    private insertSectionHost(host: HTMLElement, id: string): void {
        if (this.bodyEl == null) {
            return;
        }

        const sections = EditorSectionRegistry.getSections();
        const targetIndex = sections.findIndex((entry) => entry.id === id);
        for (let index = targetIndex + 1; index < sections.length; index += 1) {
            const nextHost = this.sectionHosts.get(sections[index]!.id);
            if (nextHost != null && nextHost.parentElement === this.bodyEl) {
                this.bodyEl.insertBefore(host, nextHost);
                return;
            }
        }
        this.bodyEl.append(host);
    }

    private close(): void {
        this.frame?.destroy();
        this.frame = null;
        this.bodyEl = null;
        this.errorsEl = null;
        this.ui = null;
        this.sectionHosts.clear();
        if (IntegrationEditorModal.openInstance === this) {
            IntegrationEditorModal.openInstance = null;
        }
    }

    private buildFooter(panel: HTMLElement): void {
        const footer = injectSection(panel, { classes: [CSSMap.FOOTER_CLASS] });
        const left = injectElement(footer, "div", { classList: [CSSMap.FOOTER_LEFT_CLASS] });
        const right = injectElement(footer, "div", { classList: [CSSMap.FOOTER_RIGHT_CLASS] });

        this.button(left, "Expand all", () => this.setAllFoldable(false));
        this.button(left, "Collapse all", () => this.setAllFoldable(true));
        this.button(left, "Import", () => void IntegrationTransfer.import());
        if (this.mode === "edit" && this.provenance === "user") {
            this.button(left, "Delete", () => this.onDelete(), true);
        }
        if (this.mode === "edit" && this.provenance === "override") {
            this.button(left, "Restore default", () => this.onRestoreDefault(), true);
        }
        this.button(right, "Cancel", () => this.close());
        this.button(right, "Save", () => this.onSave(), false, true);
    }

    private button(
        parent: HTMLElement,
        value: string,
        onClick: () => void,
        danger = false,
        primary = false,
    ): void {
        injectElement(parent, "button", {
            type: "button",
            innerText: value,
            classList: [
                UICSSMap.BUTTON_CLASS,
                ...(danger ? [UICSSMap.BUTTON_DANGER_CLASS] : []),
                ...(primary ? [UICSSMap.BUTTON_PRIMARY_CLASS] : []),
            ],
        }, { click: onClick });
    }

    private setAllFoldable(folded: boolean): void {
        if (this.bodyEl == null) {
            return;
        }

        for (const button of this.bodyEl.querySelectorAll(`.${UICSSMap.FOLD_BUTTON_CLASS}`)) {
            const heading = button.closest(`.${UICSSMap.HEADING_CLASS}`);
            const section = heading?.parentElement;
            if (section instanceof HTMLElement) {
                section.classList.toggle(UICSSMap.FOLDED_CLASS, folded);
            }
        }
    }

    private onSave(): void {
        const built = draftToIntegration(this.draft);
        if (!built.ok) {
            this.showIssues(built.issues);
            return;
        }

        const result = validateIntegration(built.value, {
            mode: this.mode,
            existingNames: new Set(
                IntegrationsRegistry.getEffective().map((integration) => integration.name),
            ),
        });
        if (!result.valid || result.value == null) {
            this.showIssues(result.issues);
            return;
        }

        const saved = result.value;
        const previous = this.mode === "edit"
            ? IntegrationsRegistry.getByName(saved.name)
            : undefined;
        const plan = this.mode === "edit"
            ? planEditorModuleConfigChanges(
                saved.name,
                moduleInstanceNames(previous),
                this.draft.modules,
            )
            : { renames: [], modulesToPurge: [] };
        if (!confirmBeforeKeyCleanup(saved.name, {
            modulesToPurge: plan.modulesToPurge,
            purgeAllIntegrationConfigs: false,
        })) {
            return;
        }

        IntegrationsRegistry.upsertStored(saved);
        applyModuleConfigRenames(saved.name, plan.renames);
        purgeRemovedModuleConfigs(saved.name, plan.modulesToPurge);
        IntegrationEditorModal.log.info("Saved integration", saved.name);
        this.finish();
    }

    private onDelete(): void {
        const name = this.draft.name;
        if (!confirmBeforeKeyCleanup(name, {
            modulesToPurge: [],
            purgeAllIntegrationConfigs: integrationHasConfigKeys(name),
        }, `Delete integration "${name}"?`)) {
            return;
        }
        IntegrationsRegistry.removeStored(name);
        purgeAllIntegrationConfigs(name);
        this.finish();
    }

    private onRestoreDefault(): void {
        const name = this.draft.name;
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
        this.finish();
    }

    private finish(): void {
        alert("Reload the page to apply the changes.");
        this.close();
    }

    private showIssues(issues: readonly IntegrationValidationIssue[]): void {
        if (this.errorsEl == null) {
            return;
        }
        this.errorsEl.hidden = false;
        this.errorsEl.replaceChildren();
        injectElement(this.errorsEl, "strong", { innerText: "Fix the following before saving:" });
        const list = injectElement(this.errorsEl, "ul");

        const targets = this.bodyEl != null
            ? applyIssueHighlights(this.bodyEl, issues)
            : new Map<string, HTMLElement>();

        for (const issue of issues) {
            const label = issue.path.length > 0 ? `${issue.path}: ${issue.message}` : issue.message;
            const target = targets.get(issue.path);
            if (target != null) {
                injectElement(list, "li", {
                    innerText: label,
                    classList: ["issue-link"],
                }, {
                    click: () => focusIssueTarget(target),
                });
            } else {
                injectElement(list, "li", { innerText: label });
            }
        }
    }
}
