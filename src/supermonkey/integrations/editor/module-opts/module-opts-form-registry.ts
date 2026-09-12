import type { ModuleOptsForm } from "./module-opts-form";

/**
 * Registry of typed module-opts forms for the integration editor.
 */
export class ModuleOptsFormRegistry {
    private static readonly forms = new Map<string, ModuleOptsForm>();

    private constructor() { }

    /**
     * Registers or replaces a form by `moduleKey`.
     */
    static register(form: ModuleOptsForm): void {
        this.forms.set(form.moduleKey, form);
    }

    /**
     * Returns the form for a ModuleLoader key, when registered.
     */
    static get(moduleKey: string): ModuleOptsForm | undefined {
        return this.forms.get(moduleKey);
    }

    /**
     * Whether a typed form exists for the key.
     */
    static has(moduleKey: string): boolean {
        return this.forms.has(moduleKey);
    }
}
