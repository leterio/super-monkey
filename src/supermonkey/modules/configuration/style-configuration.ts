import { injectStyle } from "../../utils/dom/style";
import { AbstractConfiguration, type ConfigurationOpts } from "./configuration";

export type CSSSupplier<TYPE> = ((value: TYPE) => string | null | undefined) | string;

export type StyleConfigurationOpts<TYPE> = ConfigurationOpts & {
    readonly css: CSSSupplier<TYPE>;
    readonly triggeredBy?: AbstractConfiguration<any>[];
};

/**
 * Mixin that injects a `<style>` element and reapplies CSS when the value (or triggers) change.
 */
export function StyleConfiguration<
    TYPE,
    TBase extends abstract new (...opts: any[]) => AbstractConfiguration<TYPE>,
>(Base: TBase) {
    abstract class AbstractStyleConfiguration extends Base {
        readonly styleElement: HTMLStyleElement;
        readonly css: CSSSupplier<TYPE>;

        constructor(...opts: any[]) {
            super(...opts);

            const styleOpts = this.opts as StyleConfigurationOpts<TYPE> | undefined;

            if (styleOpts?.css == null) {
                throw new Error("CSS supplier is not defined");
            }

            this.css = styleOpts.css;
            this.styleElement = injectStyle();

            this.apply(this.value);

            this.watch(this.onValueChanged.bind(this));

            if (styleOpts.triggeredBy != null) {
                for (const triggeredBy of styleOpts.triggeredBy) {
                    triggeredBy.watch(() => this.onTriggerChanged());
                }
            }
        }

        override get value(): TYPE {
            return super.value;
        }

        override set value(value: TYPE | null) {
            super.value = value;
            this.apply(this.value);
        }

        apply(value: TYPE): void {
            let css: string | null | undefined = undefined;

            if (typeof this.css === "string") {
                css = value != null ? this.css : "";
            } else if (typeof this.css === "function") {
                css = this.css(value);
            }

            this.styleElement.textContent = css ?? "";
        }

        private onValueChanged(_: TYPE | null | undefined, newValue: TYPE, remote: boolean): void {
            if (!remote) {
                return;
            }

            this.apply(newValue);
        }

        private onTriggerChanged(): void {
            this.apply(this.value);
        }
    }

    return AbstractStyleConfiguration;
}
