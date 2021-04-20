# Examples

- [Examples](#examples)
  - [C# - NuGet](#c---nuget)
  - [D - DUB](#d---dub)
  - [Elixir - Mix](#elixir---mix)
  - [Go - Modules](#go---modules)
  - [Haskell - Cabal](#haskell---cabal)
  - [Java - Gradle](#java---gradle)
  - [Java - Maven](#java---maven)
  - [Node - npm](#node---npm)
    - [macOS and Ubuntu](#macos-and-ubuntu)
    - [Windows](#windows)
    - [Using multiple systems and `npm config`](#using-multiple-systems-and-npm-config)
  - [Node - Lerna](#node---lerna)
  - [Node - Yarn](#node---yarn)
  - [Node - Yarn 2](#node---yarn-2)
  - [OCaml/Reason - esy](#ocamlreason---esy)
  - [PHP - Composer](#php---composer)
  - [Python - pip](#python---pip)
    - [Simple example](#simple-example)
    - [Multiple OSes in a workflow](#multiple-oss-in-a-workflow)
    - [Using pip to get cache location](#using-pip-to-get-cache-location)
    - [Using a script to get cache location](#using-a-script-to-get-cache-location)
  - [Python - pipenv](#python---pipenv)
  - [R - renv](#r---renv)
    - [Simple example](#simple-example-1)
    - [Multiple OSes in a workflow](#multiple-oss-in-a-workflow-1)
  - [Ruby - Bundler](#ruby---bundler)
  - [Rust - Cargo](#rust---cargo)
  - [Scala - SBT](#scala---sbt)
  - [Swift, Objective-C - Carthage](#swift-objective-c---carthage)
  - [Swift, Objective-C - CocoaPods](#swift-objective-c---cocoapods)
  - [Swift - Swift Package Manager](#swift---swift-package-manager)

## C# - NuGet
Using [NuGet lock files](https://docs.microsoft.com/nuget/consume-packages/package-references-in-project-files#locking-dependencies):

```yaml
- uses: actions/cache@v2
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
    restore-keys: |
      ${{ runner.os }}-nuget-
```

Depending on the environment, huge packages might be pre-installed in the global cache folder.
With `actions/cache@v2` you can now exclude unwanted packages with [exclude pattern](https://github.com/actions/toolkit/tree/main/packages/glob#exclude-patterns)
```yaml
- uses: actions/cache@v2
  with:
    path: | 
      ~/.nuget/packages
      !~/.nuget/packages/unwanted
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
    restore-keys: |
      ${{ runner.os }}-nuget-
```

Or you could move the cache folder like below.
>Note: This workflow does not work for projects that require files to be placed in user profile package folder
```yaml
env:
  NUGET_PACKAGES: ${{ github.workspace }}/.nuget/packages
steps:
  - uses: actions/cache@v2
    with:
      path: ${{ github.workspace }}/.nuget/packages
      key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
      restore-keys: |
        ${{ runner.os }}-nuget-
```

## D - DUB

### POSIX

```yaml
- uses: actions/cache@v2
  with:
    path: ~/.dub
    key: ${{ runner.os }}-dub-${{ hashFiles('**/dub.json') }}
    restore-keys: |
      ${{ runner.os }}-dub-
```

### Windows

```yaml
- uses: actions/cache@v2
  with:
    path: ~\AppData\Local\dub
    key: ${{ runner.os }}-dub-${{ hashFiles('**/dub.json') }}
    restore-keys: |
      ${{ runner.os }}-dub-
```

## Elixir - Mix

```yaml
- uses: actions/cache@v2
  with:
    path: |
      deps
      _build
    key: ${{ runner.os }}-mix-${{ hashFiles('**/mix.lock') }}
    restore-keys: |
      ${{ runner.os }}-mix-
```

## Go - Modules

```yaml
- uses: actions/cache@v2
  with:
    path: ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

## Haskell - Cabal

We cache the elements of the Cabal store separately, as the entirety of `~/.cabal` can grow very large for projects with many dependencies.

```yaml
- name: Cache ~/.cabal/packages, ~/.cabal/store and dist-newstyle
  uses: actions/cache@v2
  with:
    path: |
      ~/.cabal/packages
      ~/.cabal/store
      dist-newstyle
    key: ${{ runner.os }}-${{ matrix.ghc }}
```

## Java - Gradle

```yaml
- uses: actions/cache@v2
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
    restore-keys: |
      ${{ runner.os }}-gradle-
```

## Java - Maven

```yaml
- name: Cache local Maven repository
  uses: actions/cache@v2
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
    restore-keys: |
      ${{ runner.os }}-maven-
```

## Node - npm

For npm, cache files are stored in `~/.npm` on Posix, or `%AppData%/npm-cache` on Windows. See https://docs.npmjs.com/cli/cache#cache

If using `npm config` to retrieve the cache directory, ensure you run [actions/setup-node](https://github.com/actions/setup-node) first to ensure your `npm` version is correct.

>Note: It is not recommended to cache `node_modules`, as it can break across Node versions and won't work with `npm ci`

### macOS and Ubuntu

```yaml
- uses: actions/cache@v2
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Windows

```yaml
- name: Get npm cache directory
  id: npm-cache
  run: |
    echo "::set-output name=dir::$(npm config get cache)"
- uses: actions/cache@v2
  with:
    path: ${{ steps.npm-cache.outputs.dir }}
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Using multiple systems and `npm config`

```yaml
- name: Get npm cache directory
  id: npm-cache-dir
  run: |
    echo "::set-output name=dir::$(npm config get cache)"
- uses: actions/cache@v2
  id: npm-cache # use this to check for `cache-hit` ==> if: steps.npm-cache.outputs.cache-hit != 'true'
  with:
    path: ${{ steps.npm-cache-dir.outputs.dir }}
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## Node - Lerna

```yaml
- name: restore lerna
  uses: actions/cache@v2
  with:
    path: |
      node_modules
      */*/node_modules
    key: ${{ runner.os }}-${{ hashFiles('**/yarn.lock') }}
```

## Node - Yarn
The yarn cache directory will depend on your operating system and version of `yarn`. See https://yarnpkg.com/lang/en/docs/cli/cache/ for more info.

```yaml
- name: Get yarn cache directory path
  id: yarn-cache-dir-path
  run: echo "::set-output name=dir::$(yarn cache dir)"

- uses: actions/cache@v2
  id: yarn-cache # use this to check for `cache-hit` (`steps.yarn-cache.outputs.cache-hit != 'true'`)
  with:
    path: ${{ steps.yarn-cache-dir-path.outputs.dir }}
    key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      ${{ runner.os }}-yarn-
```


## Node - Yarn 2
The yarn 2 cache directory will depend on your config. See https://yarnpkg.com/configuration/yarnrc#cacheFolder for more info.

```yaml
- name: Get yarn cache directory path
  id: yarn-cache-dir-path
  run: echo "::set-output name=dir::$(yarn config get cacheFolder)"

- uses: actions/cache@v2
  id: yarn-cache # use this to check for `cache-hit` (`steps.yarn-cache.outputs.cache-hit != 'true'`)
  with:
    path: ${{ steps.yarn-cache-dir-path.outputs.dir }}
    key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      ${{ runner.os }}-yarn-
```

## OCaml/Reason - esy
Esy allows you to export built dependencies and import pre-built dependencies.
```yaml
    - name: Restore Cache
      id: restore-cache
      uses: actions/cache@v2
      with:
        path: _export
        key:  ${{ runner.os }}-esy-${{ hashFiles('esy.lock/index.json') }}
        restore-keys: |
          ${{ runner.os }}-esy-
    - name: Esy install
      run: 'esy install'
    - name: Import Cache
      run: |
        esy import-dependencies _export
        rm -rf _export

    ...(Build job)...

    # Re-export dependencies if anything has changed or if it is the first time
    - name: Setting dependency cache 
      run: |
        esy export-dependencies
      if: steps.restore-cache.outputs.cache-hit != 'true'
```


## PHP - Composer

```yaml
- name: Get Composer Cache Directory
  id: composer-cache
  run: |
    echo "::set-output name=dir::$(composer config cache-files-dir)"
- uses: actions/cache@v2
  with:
    path: ${{ steps.composer-cache.outputs.dir }}
    key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
    restore-keys: |
      ${{ runner.os }}-composer-
```

## Python - pip

For pip, the cache directory will vary by OS. See https://pip.pypa.io/en/stable/reference/pip_install/#caching

Locations:
 - Ubuntu: `~/.cache/pip`
 - Windows: `~\AppData\Local\pip\Cache`
 - macOS: `~/Library/Caches/pip`

### Simple example
```yaml
- uses: actions/cache@v2
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

Replace `~/.cache/pip` with the correct `path` if not using Ubuntu.

### Multiple OS's in a workflow

```yaml
- uses: actions/cache@v2
  if: startsWith(runner.os, 'Linux')
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

- uses: actions/cache@v2
  if: startsWith(runner.os, 'macOS')
  with:
    path: ~/Library/Caches/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

- uses: actions/cache@v2
  if: startsWith(runner.os, 'Windows')
  with:
    path: ~\AppData\Local\pip\Cache
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

### Multiple OS's in a workflow with a matrix

``` yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        include:
        - os: ubuntu-latest
          path: ~/.cache/pip
        - os: macos-latest
          path: ~/Library/Caches/pip
        - os: windows-latest
          path: ~\AppData\Local\pip\Cache
    steps:
    - uses: actions/cache@v2
      with:
        path: ${{ matrix.path }}
        key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
        restore-keys: |
         ${{ runner.os }}-pip-
```

### Using pip to get cache location

> Note: This requires pip 20.1+
```yaml
- name: Get pip cache dir
  id: pip-cache
  run: |
    echo "::set-output name=dir::$(pip cache dir)"

- name: pip cache
  uses: actions/cache@v2
  with:
    path: ${{ steps.pip-cache.outputs.dir }}
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

## Python - pipenv

```yaml
- uses: actions/cache@v2
  with:
    path: ~/.local/share/virtualenvs
    key: ${{ runner.os }}-pipenv-${{ hashFiles('Pipfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-pipenv-
```

## R - renv

For renv, the cache directory will vary by OS. Look at https://rstudio.github.io/renv/articles/renv.html#cache

Locations:
 - Ubuntu: `~/.local/share/renv`
 - macOS: `~/Library/Application Support/renv`
 - Windows: `%LOCALAPPDATA%/renv`

### Simple example
```yaml
- uses: actions/cache@v2
  with:
    path: ~/.local/share/renv
    key: ${{ runner.os }}-renv-${{ hashFiles('**/renv.lock') }}
    restore-keys: |
      ${{ runner.os }}-renv-
```

Replace `~/.local/share/renv` with the correct `path` if not using Ubuntu.

### Multiple OS's in a workflow

```yaml
- uses: actions/cache@v2
  if: startsWith(runner.os, 'Linux')
  with:
    path: ~/.local/share/renv
    key: ${{ runner.os }}-renv-${{ hashFiles('**/renv.lock') }}
    restore-keys: |
      ${{ runner.os }}-renv-

- uses: actions/cache@v2
  if: startsWith(runner.os, 'macOS')
  with:
    path: ~/Library/Application Support/renv
    key: ${{ runner.os }}-renv-${{ hashFiles('**/renv.lock') }}
    restore-keys: |
      ${{ runner.os }}-renv-

- uses: actions/cache@v2
  if: startsWith(runner.os, 'Windows')
  with:
    path: ~\AppData\Local\renv
    key: ${{ runner.os }}-renv-${{ hashFiles('**/renv.lock') }}
    restore-keys: |
      ${{ runner.os }}-renv-
```

## Ruby - Bundler

Caching gems with Bundler correctly is not trivial and just using `actions/cache`
is [not enough](https://github.com/ruby/setup-ruby#caching-bundle-install-manually).

Instead, it is recommended to use `ruby/setup-ruby`'s
[`bundler-cache: true` option](https://github.com/ruby/setup-ruby#caching-bundle-install-automatically)
whenever possible:

```yaml
- uses: ruby/setup-ruby@v1
  with:
    ruby-version: ...
    bundler-cache: true
```

## Rust - Cargo

```yaml
- uses: actions/cache@v2
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      target
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

## Scala - SBT

```yaml
- name: Cache SBT
  uses: actions/cache@v2
  with:
    path: | 
      ~/.ivy2/cache
      ~/.sbt
    key: ${{ runner.os }}-sbt-${{ hashFiles('**/build.sbt') }}
```

## Swift, Objective-C - Carthage

```yaml
- uses: actions/cache@v2
  with:
    path: Carthage
    key: ${{ runner.os }}-carthage-${{ hashFiles('**/Cartfile.resolved') }}
    restore-keys: |
      ${{ runner.os }}-carthage-
```

## Swift, Objective-C - CocoaPods

```yaml
- uses: actions/cache@v2
  with:
    path: Pods
    key: ${{ runner.os }}-pods-${{ hashFiles('**/Podfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-pods-
```

## Swift - Swift Package Manager

```yaml
- uses: actions/cache@v2
  with:
    path: .build
    key: ${{ runner.os }}-spm-${{ hashFiles('**/Package.resolved') }}
    restore-keys: |
      ${{ runner.os }}-spm-
```
