import { injectSection } from "../../../utils/ui/ui-builder";
import { EditorSection } from "../editor-section";
import { EditorSectionRegistry } from "../editor-section-registry";

const matchedDomainsSection: EditorSection = {
    id: "matched-domains",
    title: "Matched domains",
    order: 20,
    mount(ctx) {
        const { draft, body, ui } = ctx;
        const section = injectSection(body, {
            title: "Matched domains",
            subtitle: "Hostnames and globs that activate this integration.",
            foldable: true,
        });
        section.dataset.path = "matchedDomains";
        ui.field(
            section,
            "matched-domains",
            "Matched domains",
            ui.textInput(draft.matchedDomains, (value) => {
                draft.matchedDomains = value;
            }),
            {
                path: "matchedDomains",
                help: "Comma-separated hostname globs. Prefix exclusions with !!.",
            },
        );
    },
};

EditorSectionRegistry.register(matchedDomainsSection);
