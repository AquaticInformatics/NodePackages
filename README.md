# NodePackages
Self-hosted repository for NPM packages.

## Important dev note:
NPM does not support targeting folders within a repository. This repository is a workaround to allow for the hosting of multiple NPM packages in a single repository.
Each package is stored on a separate branch.<br/>
NPM packages are published from the branch with the same name as the package.

e.g. The `angular-aria` package is stored on the `angular-aria` branch.<br/>
Package contents must be at the root of the branch or else they will not be picked up by NPM. i.e. not within a subfolder named `angular-aria`
