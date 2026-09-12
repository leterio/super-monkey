# Logger

Console logger used by bootstrap, loaders, Content Manager, and feature modules (`src/supermonkey/utils/logger.ts`). Each instance carries a context label. `Module` and `Component` expose `this.log`, scoped to the instance name - see [Authoring a module](../modules/authoring.md).

```ts
this.log.info("Ready");
this.log.debug("Resolved context", context);
```

## Message shape

Every line starts with the script name and the level label, then the context, then the message arguments:

```text
SuperMonkey - INFO  - SuperMonkey - Starting SuperMonkey ...
```

For `trace` and `debug`, when the last argument is an object or array it is omitted from the prefixed line and passed to `console.table`.

## Levels

| Method  | Value | Console call                                   | Emits                       |
| ------- | ----- | ---------------------------------------------- | --------------------------- |
| `trace` | 0     | `console.debug`, plus optional `console.table` | Threshold at trace          |
| `debug` | 1     | `console.debug`, plus optional `console.table` | Threshold at or below debug |
| `info`  | 2     | `console.log`                                  | Threshold at or below info  |
| `warn`  | 3     | `console.warn`                                 | Threshold at or below warn  |
| `error` | 4     | `console.error`                                | Always                      |
| `fatal` | 5     | `console.error`                                | Always                      |

`isTraceEnabled()`, `isDebugEnabled()`, `isInfoEnabled()`, and `isWarnEnabled()` report the threshold.

## Threshold

`Logger.logLevel` is the process-wide threshold. Boot resolution:

| Build                    | Boot threshold                                |
| ------------------------ | --------------------------------------------- |
| Development (`pnpm dev`) | Debug, or trace when stored `logLevel` is `0` |
| Production               | Tampermonkey `logLevel`, default `2` (info)   |

`Logger.setLevel(level)` clamps to `0`–`5`, updates the threshold immediately (including in development), and persists Tampermonkey `logLevel`.

The Integrations Menu footer is a TRACE through FATAL picker that calls `setLevel`.

## Fatal blocks

```ts
this.log.fatal(`Failed to load module: ${instanceName}`, error, "Please check the integration configuration and module options.");
```

`fatal` renders one delimited block with the main message, the error message (or `String` of the value), and any extra lines.

## See also

- [Authoring a module](../modules/authoring.md)
- [TypeScript integration](../integrations/README.md#integrations-menu)
- [Debugging](../development/debugging.md)
- [Script Lifecycle](../supermonkey/lifecycle.md)
