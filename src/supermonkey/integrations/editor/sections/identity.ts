import { injectSection } from "../../../utils/ui/ui-builder";
import { EditorSection } from "../editor-section";
import { EditorSectionRegistry } from "../editor-section-registry";

const identitySection: EditorSection = {
    id: "identity",
    title: "Identity",
    order: 10,
    visible: ({ mode }) => mode === "create",
    mount(ctx) {
        const { draft, body, ui } = ctx;
        const section = injectSection(body, {
            title: "Identity",
            subtitle: "Choose a unique id for this integration.",
            foldable: true,
        });
        ui.field(section, "integration-name", "Name", ui.textInput(draft.name, (value) => {
            draft.name = value;
        }), { path: "name", help: "Use letters, digits, hyphens, and underscores only." });
    },
};

EditorSectionRegistry.register(identitySection);
