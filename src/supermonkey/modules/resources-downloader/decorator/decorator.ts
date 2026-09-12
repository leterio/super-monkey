import { closestMatching, createElement } from "../../../utils/dom/elements";
import { Logger } from "../../../utils/logger";
import {
    DECORATED_BY_ATTR,
    Resource,
    ResourceDownloadClickHandler,
    ResourcesDecoration,
    ResourcesMapping,
} from "../metadata";
import downloadIconSvgRaw from "../save-svgrepo-com.svg?raw";

enum CSSMap {
    WRAP_CLASS = "sm-rd-wrap",
    DOWNLOAD_BTN_CLASS = "sm-rd-download-btn",
}

export class ResourcesDecorator {
    private readonly log: Logger = new Logger("ResourcesDecorator");

    constructor(private readonly mappings: Record<string, ResourcesMapping>) { }

    decorate(resources: Resource[], onDownloadClick: ResourceDownloadClickHandler): void {
        this.log.debug("Decorating", resources.length, "resources");

        for (const resource of resources) {
            this.decorateResource(resource, onDownloadClick);
        }
    }

    private decorateResource(resource: Resource, onDownloadClick: ResourceDownloadClickHandler): void {
        if (resource.type === "collection") {
            for (const child of resource.children) {
                this.decorateResource(child, onDownloadClick);
            }
        }

        const mapping = this.mappings[resource.mappedBy];
        if (mapping?.ignoreDecoration === true) {
            return;
        }

        const container = this.resolveDecorationContainer(resource, mapping?.decoration);
        if (container.hasAttribute(DECORATED_BY_ATTR)) {
            return;
        }

        const button = createElement("button", {
            type: "button",
            classList: [CSSMap.DOWNLOAD_BTN_CLASS],
            title: "Download",
            innerHTML: downloadIconSvgRaw,
        }, {
            click: (event) => {
                event.preventDefault();
                event.stopPropagation();
                onDownloadClick(resource);
            },
        });

        container.setAttribute(DECORATED_BY_ATTR, resource.mappedBy);
        resource.downloadButton = button;
        container.appendChild(button);
    }

    private resolveDecorationContainer(
        resource: Resource,
        decoration: ResourcesDecoration | undefined,
    ): HTMLElement {
        let target = resource.element;

        if (decoration?.useImmediateParent === true) {
            if (target.parentElement != null) {
                target = target.parentElement;
            }
        } else if (decoration?.closestSelectors != null) {
            const closest = closestMatching(resource.element, decoration.closestSelectors);
            if (closest != null) {
                target = closest;
            }
        }

        if (decoration?.wrapElement === true) {
            target = ResourcesDecorator.wrapDecorationTarget(target, decoration);
        }

        if (decoration?.overridePosition === true) {
            target.style.setProperty("position", "relative", "important");
        }

        return target;
    }

    private static wrapDecorationTarget(
        target: HTMLElement,
        decoration: ResourcesDecoration,
    ): HTMLElement {
        if (target.parentElement?.classList.contains(CSSMap.WRAP_CLASS)) {
            return target.parentElement;
        }

        const classList: string[] = [];

        if (decoration.wrapClasses != null && decoration.wrapClasses.length > 0) {
            classList.push(...decoration.wrapClasses);
        }

        if (decoration.wrapCopyElementClasses === true) {
            classList.push(...Array.from(target.classList));
        }

        classList.push(CSSMap.WRAP_CLASS);

        const wrapper = createElement("div", { classList });
        target.replaceWith(wrapper);
        wrapper.appendChild(target);
        return wrapper;
    }
}
