Dynamic Analytics Core
======================

Framework-agnostic dynamic analytics engine — DOM event delegation, event sequences, and remote
JSON configuration loading. Works in **plain JavaScript**, **AngularJS 1.x**, **React**, **Angular**
(via the `dynamic-analytics` package, which wraps this one), or any other JS environment. Has no
required dependency on any UI framework.

### Install

```bash
npm install https://github.com/AquaticInformatics/NodePackages#dynamic-analytics-core
```

### Distribution formats

| File                  | Format                | Use case                                                |
|------------------------|------------------------|-----------------------------------------------------------|
| `index.mjs`            | ESM                    | Modern bundlers (`import ... from 'dynamic-analytics-core'`) |
| `index.cjs`            | CommonJS               | `require('dynamic-analytics-core')`                        |
| `index.global.js`      | IIFE / global (`DynamicAnalyticsCore`) | Plain `<script>` tag, no bundler — e.g. legacy AngularJS 1.x pages |
| `index.d.ts`           | TypeScript declarations | Full type hinting in any TS/IDE-aware consumer (including React) |

### Plain JS / `<script>` tag usage

```html
<script src="node_modules/dynamic-analytics-core/index.global.js"></script>
<script>
  const analytics = new DynamicAnalyticsCore.DynamicAnalyticsCore();
  analytics.onEvent.subscribe(event => console.log(event));
  analytics.initialize('/config.json', (min, max) => true);
</script>
```

### Bundler-based JS/TS usage

```ts
import { DynamicAnalyticsCore } from 'dynamic-analytics-core';

const analytics = new DynamicAnalyticsCore();
analytics.onEvent.subscribe(event => sendToAnalyticsBackend(event));
analytics.initialize('/config.json', (min, max) => isVersionCompatible(min, max));
```

### AngularJS 1.x usage

```js
import angular from 'angular';
import { registerDynamicAnalyticsAngularJsModule } from 'dynamic-analytics-core/angularjs';

const dynamicAnalyticsModuleName = registerDynamicAnalyticsAngularJsModule(angular);
angular.module('myApp', [dynamicAnalyticsModuleName]);

// Injected like any other AngularJS service:
// function MyController(dynamicAnalyticsService) {
//   dynamicAnalyticsService.initialize('/config.json', (min, max) => isVersionCompatible(min, max));
// }
```

Events are re-entered via `$rootScope.$applyAsync`, so AngularJS bindings/watchers reacting to
`onEvent` still update.

### React usage

```tsx
import { useDynamicAnalytics } from 'dynamic-analytics-core/react';

function App() {
  const analytics = useDynamicAnalytics({
    onEvent: event => sendToAnalyticsBackend(event),
  });

  useEffect(() => {
    analytics.initialize('/config.json', (min, max) => isVersionCompatible(min, max));
  }, [analytics]);

  return <div>...</div>;
}
```

The hook creates a single `DynamicAnalyticsCore` instance per component and calls `destroy()`
automatically on unmount.

### Initializing: `initialize()` vs `initializeWithConfig()`

- **`initialize(url, versionFilterPredicate, translateTextContent?)`** — the primary, intended way
  to initialize in production. It fetches the `IEventConfigDefinition` JSON from `url` at runtime,
  so the configuration can be updated independently of your application's deployment.
- **`initializeWithConfig(eventConfigDefinition, versionFilterPredicate, translateTextContent?)`** —
  initializes directly from an in-memory config object instead of fetching one. This exists for
  **unit tests** and for **previewing/validating a configuration before deployment** (e.g. in the
  configurator app) — it is not intended for production use.

### Configuration structure, event types, and validation rules

See the main [`dynamic-analytics`](https://github.com/AquaticInformatics/NodePackages/tree/dynamic-analytics)
README for the full configuration reference (`IEventConfigDefinition`, event types, sequences,
selectors, etc.) — the type surface is identical; only the hosting/integration layer differs.

### Extending to other frameworks

`DynamicAnalyticsCore` accepts optional `configLoader`, `runOutsideZone`, and `runInZone` hooks in
its constructor, letting any framework plug in its own HTTP client and change-detection/digest
integration without forking the core logic.
