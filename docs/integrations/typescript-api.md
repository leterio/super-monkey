# TypeScript API index

Map of public TypeScript types and classes to source files and narrative docs. Paths are under `src/supermonkey/` unless noted.

| Symbol | Source | Docs |
| ------ | ------ | ---- |
| `Integration` | `integrations/metadata.ts` | [TypeScript integration](./README.md#integration-fields) |
| `IntegrationMappedPage` | `integrations/metadata.ts` | [Mapped pages (TypeScript)](./README.md#mapped-pages-typescript) · [Path patterns](./dsl.md#path-patterns) |
| `IntegrationModule` | `integrations/metadata.ts` | [Authoring a module](../modules/authoring.md) |
| `LoadedIntegration` | `integrations/metadata.ts` | [Script Lifecycle](../supermonkey/lifecycle.md) |
| `BuiltinIntegrations` | `integrations/builtin/builtin.ts` | [Register a built-in](./README.md#register-a-built-in-integration) |
| `IntegrationsRegistry` | `integrations/integrations-registry.ts` | [Effective registry](./README.md#effective-registry) |
| `IntegrationProvenance` | `integrations/integrations-registry.ts` | [Effective registry](./README.md#effective-registry) |
| `UserIntegrationsStore` | `integrations/store/user-integrations-store.ts` | [User storage](./README.md#user-storage) |
| `USER_INTEGRATIONS_STORAGE_KEY` | `integrations/store/user-integrations-store.ts` | [User storage](./README.md#user-storage) |
| `normalizeStoredIntegration` | `integrations/store/normalize-stored-integration.ts` | [Normalization](./README.md#normalization) |
| `validateIntegration` | `integrations/integration-validation.ts` | [Validation](./editor-ui.md#validation) |
| `createGetActivePages` | `integrations/mapped-pages.ts` | [Mapped pages (TypeScript)](./README.md#mapped-pages-typescript) · [DSL Contributors](./dsl.md#contributors) |
| `IntegrationLoader` | `integrations/integration-loader.ts` | [Script Lifecycle](../supermonkey/lifecycle.md) |
| `IntegrationsMenu` | `integrations/menu/integrations-menu.ts` | [Integrations Menu](../modules/integrations-menu.md) |
| `SuperMonkey` | `supermonkey.ts` | [Script Lifecycle](../supermonkey/lifecycle.md) · [Overview](../supermonkey/overview.md) |
| `LifecycleAwareEvent` | `lifecycle/events.ts` | [Script Lifecycle](../supermonkey/lifecycle.md) · [Event bus](../utils/event-bus.md) |
| `Component` | `lifecycle/component.ts` | [Script Lifecycle](../supermonkey/lifecycle.md) · [Event bus](../utils/event-bus.md) |
| `EventBus` | `event-bus/event-bus.ts` | [Event bus](../utils/event-bus.md) |
| `ContentManager` / `ContentManagerLoader` | `content-manager/` | [Content Manager](../modules/content-manager.md) |
| `ContentManagerOpts` / `ScanMode` | `content-manager/metadata.ts` | [Content Manager](../modules/content-manager.md) |
| `ContentManagerEvents` | `content-manager/events.ts` | [Content Manager - Events](../modules/content-manager.md#events) |
| `Module` / `ModuleLoader` | `modules/module.ts`, `modules/module-loader.ts` | [Authoring a module](../modules/authoring.md) · [Modules overview](../modules/README.md) |
| `Action` / Configuration | `modules/configuration/action.ts`, `modules/configuration/configuration.ts` | [Configuration - Action](../modules/configuration.md#action) |
| `Normalized` / opts normalizers | `utils/opts/normalization.ts` | [Opts normalization](../utils/opts-normalization.md) |
| `passesPageFilter` | `utils/page-filter.ts` | [Page filter](../utils/page-filter.md) |
| `ValueSource` / `resolveValue` | `utils/value-resolver.ts` (and related) | [Value source](../utils/value-source.md) |
| `getValue` / `setValue` (value storage) | `utils/value.ts` | [Value storage](../utils/value-storage.md) |
| `Logger` | `utils/logger.ts` | [Logger](../utils/logger.md) |

## See also

- [TypeScript integration](./README.md)
- [Module opts by key](./README.md#module-opts-by-key)
- [Register a built-in integration](./README.md#register-a-built-in-integration)
- [Authoring a module](../modules/authoring.md)
- [AGENTS.md](../../AGENTS.md) (repository root)
