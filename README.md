# AngularJS Mocks

This repository enables distribution to npm-compatible clients. The original source for this module
is in the [AngularJS repo](https://github.com/angular/angular.js/tree/master/src/ngMock).

## Install

You can install this package with `npm`.

### npm

```shell
npm install @xlts.dev/angular-mocks
```

You can `require` ngMock modules:

```javascript
var angular = require('@xlts.dev/angular');
angular.module('myMod', [
  require('@xlts.dev/angular-animate'),
  require('@xlts.dev/angular-mocks/ngMock'),
  require('@xlts.dev/angular-mocks/ngAnimateMock')
]);
```

## Documentation

Documentation is available on the
[XLTS for AngularJS docs site](https://docs.angularjs.xlts.dev/guide/unit-testing).
