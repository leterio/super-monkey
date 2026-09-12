import { ModuleLoader } from "../../../modules/module-loader";
import { randomString } from "../../../utils/string";
import { injectSection } from "../../../utils/ui/ui-builder";
import { DraftIntegrationModule } from "../draft-mappers";
import { EditorSection } from "../editor-section";
import { EditorSectionRegistry } from "../editor-section-registry";
import type { EditorUiHelpers } from "../editor-ui-helpers";
import { hydrateModuleOpts } from "../module-opts/apply-module-opts";
import { ModuleOptsFormRegistry } from "../module-opts/module-opts-form-registry";
import "../module-opts/register-builtin-opts-forms";

const modulesSection: EditorSection = {
    id: "modules",
    title: "Modules",
    order: 50,
    mount(ctx) {
        const { draft, body, ui } = ctx;
        const section = injectSection(body, {
            title: "Modules",
            subtitle: "Features loaded for this integration.",
            foldable: true,
            folded: true,
            button: {
                label: "Add module",
                onClick: () => {
                    const module: DraftIntegrationModule = {
                        instanceName: "",
                        module: "",
                        optsText: "",
                    };
                    draft.modules.push(module);
                    ui.focusBlock(section, mountModule(section, module, draft.modules, ui));
                },
            },
        });
        draft.modules.forEach((module) => mountModule(section, module, draft.modules, ui));
    },
};

function modulePath(module: DraftIntegrationModule, modules: DraftIntegrationModule[]): string {
    const name = module.instanceName.trim();
    const index = modules.indexOf(module);
    return name.length > 0 ? `modules.${name}` : `modules[${index}]`;
}

function syncModulePaths(
    section: HTMLElement,
    nameInputId: string,
    moduleInputId: string,
    module: DraftIntegrationModule,
    modules: DraftIntegrationModule[],
    ui: EditorUiHelpers,
): void {
    const base = modulePath(module, modules);
    ui.setPath(section, base);
    ui.setFieldPath(section, nameInputId, base);
    ui.setFieldPath(section, moduleInputId, `${base}.module`);
}

function mountModule(
    list: HTMLElement,
    module: DraftIntegrationModule,
    modules: DraftIntegrationModule[],
    ui: EditorUiHelpers,
): HTMLElement {
    const indexOf = () => modules.indexOf(module);
    const titleEl = ui.namedBlockHeading("Module", indexOf(), module.instanceName);
    const section = ui.removableSection(list, titleEl, () => {
        ui.remove(modules, module, section);
        ui.syncNamedListHeadings(
            list,
            modules.map((entry) => entry.instanceName),
            "Module",
        );
    }, true, true, modulePath(module, modules));
    const id = `module-${randomString(8)}`;
    const nameInputId = `${id}-name`;
    const moduleInputId = `${id}-module`;
    ui.field(section, nameInputId, "Instance name", ui.textInput(
        module.instanceName,
        (value) => {
            module.instanceName = value;
            ui.syncNamedBlockHeading(titleEl, "Module", indexOf(), value);
            syncModulePaths(section, nameInputId, moduleInputId, module, modules, ui);
        },
    ), {
        path: modulePath(module, modules),
        help: "Letters, digits, hyphens, and underscores. Unique within this integration.",
    });
    const availableKeys = ModuleLoader.getAvailableConstructors();
    const moduleKeys = module.module.length > 0 && !availableKeys.includes(module.module)
        ? [module.module, ...availableKeys]
        : availableKeys;
    const moduleKeyOptions = ["", ...moduleKeys];

    const optsStart = document.createComment("module-opts");
    const optsEnd = document.createComment("/module-opts");
    const remountOpts = () => {
        while (optsStart.nextSibling !== optsEnd) {
            optsStart.nextSibling!.remove();
        }
        const form = ModuleOptsFormRegistry.get(module.module);
        if (form == null) {
            return;
        }
        const staging = document.createElement("div");
        form.mount({
            module,
            host: staging,
            ui,
            pathPrefix: `${modulePath(module, modules)}.opts`,
            requestRerender: remountOpts,
        });
        while (staging.firstChild != null) {
            section.insertBefore(staging.firstChild, optsEnd);
        }
    };

    ui.field(
        section,
        moduleInputId,
        "Module key",
        ui.select(
            moduleKeyOptions,
            moduleKeyOptions.includes(module.module) ? module.module : "",
            (value) => {
                module.module = value;
                hydrateModuleOpts(module, undefined);
                remountOpts();
            },
            {
                "": "(select a module)",
                ...Object.fromEntries(moduleKeys.map((key) => [key, key])),
            },
        ),
        {
            path: `${modulePath(module, modules)}.module`,
            help: "Constructor registered in ModuleLoader.",
        },
    );
    section.append(optsStart, optsEnd);
    remountOpts();
    return section;
}

EditorSectionRegistry.register(modulesSection);
