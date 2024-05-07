<a name="1.9.3"></a>
# 1.9.3 sublinear-dismantling (2023-08-17)


## Bug Fixes
- **$compile:** fix a possible ReDoS in `ng-srcset` parsing
- **route:** suppress warning from CodeQL regarding escaping backslash characters


<a name="1.9.2"></a>
# 1.9.2 kinetic-stabilization (2023-07-06)


## Bug Fixes
- **ngAnimate:** make animation duration calculation compatible with [CSS Animations Level 2](https://www.w3.org/TR/css-animations-2/#animation-duration)
- **browserTrigger:** fix focus triggering in IE with jQuery >=3.7.0
- **bootstrap:** no longer trigger RegExp warning in CodeQL scans


<a name="1.9.1"></a>
# 1.9.1 supersonically-starting (2023-01-10)


## Bug Fixes
- **$compile:** fix mergeConsecutiveTextNodes logic in for jQuery v4 preview
- **$resource:** avoid ReDoS in stripping trailing slashes
- **Angular:**
  - collect jQuery nodes between two elements correctly for jQuery v4 preview
  - make a regex used in angular.copy ReDoS-safe
- **input:** make URL_REGEXP less ambiguous to avoid possible ReDoS


<a name="1.9.0"></a>
# 1.9.0 crossly-blocking (2022-05-25)


## Bug Fixes
- **textarea:** avoid interpolating when going back/forward on IE

## New Features
- **Angular:** implement angular.version.vendor
  - This now holds the value "XLTS.dev" for ease of determining if a supported version of AngularJS
    is running in a given app

## Breaking Changes

### **textarea** due to:
- avoid interpolating when going back/forward on IE

Previously, the HTML contents of `<textarea>` elements were interpolated
on all browsers. Due to how page caching works on Internet Explorer,
this could lead to a `<textarea>` value's being interpolated when
navigating back/forward to a page, even when the value was not
originally inline in the HTML.

Due to security considerations, the HTML contents of `<textarea>`
elements are no longer interpolated on Internet Explorer. If you want to
set the `<textarea>` element's value by evaluating an AngularJS
expression, you can use
[ng-bind](https://docs.angularjs.xlts.dev/api/ng/directive/ngBind) or
[ng-prop-value](https://docs.angularjs.xlts.dev/api/ng/directive/ngProp).

For example:
```html
<!-- Before: -->
<textarea>{{ 1 + 2 }}</textarea>

<!-- After: -->
<textarea ng-bind="1 + 2"></textarea>
<!-- ...or... -->
<textarea ng-prop-value="1 + 2"></textarea>
```


<a name="1.8.8"></a>
# 1.8.8 energetically-guarding (2022-04-11)


## Bug Fixes
- **$filter:** fix ReDoS issue in `currencyFilter`
  - This fixes a [Medium Severity](https://security.snyk.io/vuln/SNYK-JS-ANGULAR-2772735) ReDoS
    vulnerability ([CVE-2022-25844](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2022-25844)).
- **ngMocks:** use a more performant regex in `stripQueryAndHash`


<a name="1.8.7"></a>
# 1.8.7 childlike-rejuvenation (2021-09-21)

## New Features
- **ngCompileExtPreAssignBindings:**
  - introduce `ngCompileExtPreAssignBindings` module
  - add types for the `ngCompileExtPreAssignBindings` module
- **jqLite:** print console warnings for vulnerable HTML input


<a name="1.8.6"></a>
# 1.8.6 incrementally-mending (2021-08-21)


## Bug Fixes
- **docs:** linting cleanup of the web worker used for search
- **$sce:** fix docs URL in `iequirks` error
- **$interpolate:** fix docs URL in `noconcat` error
- **jqlite:** nosel error points to an invalid URL
- **multiple:** update error references to use code.angularjs.xlts.dev


<a name="1.8.5"></a>
# 1.8.5 identically-looming (2021-05-29)

This is the first XLTS for AngularJS release! 🚀

As such, there have been updates to the License and the Security Policy. New security issues should
be sent to [security@xlts.dev](mailto:security@xlts.dev).

## Bug Fixes
- ***:** fix 68 npm security audit warnings, _mostly_ with the build tooling
- ***:** fix 20 GitHub Dependabot security alerts
