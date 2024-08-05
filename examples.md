# Examples

- [C# - NuGet](#c---nuget)
- [Clojure - Lein Deps](#clojure---lein-deps)
- [D - DUB](#d---dub)
  - [POSIX](#posix)
  - [Windows](#windows)
- [Deno](#deno)
  - [Linux](#linux)
  - [macOS](#macos)
  - [Windows](#windows-1)
- [Elixir - Mix](#elixir---mix)
- [Erlang - Rebar3](#erlang--rebar3)
- [Go - Modules](#go---modules)
  - [Linux](#linux-1)
  - [macOS](#macos-1)
  - [Windows](#windows-2)
- [Haskell - Cabal](#haskell---cabal)
- [Haskell - Stack](#haskell---stack)
- [Java - Gradle](#java---gradle)
- [Java - Maven](#java---maven)
- [Node - npm](#node---npm)
- [Node - Lerna](#node---lerna)
- [Node - Yarn](#node---yarn)
- [Node - Yarn 2](#node---yarn-2)
- [OCaml/Reason - esy](#ocamlreason---esy)
- [PHP - Composer](#php---composer)
- [Python - pip](#python---pip)
  - [Simple example](#simple-example)
  - [Multiple OS's in a workflow](#multiple-oss-in-a-workflow)
  - [Multiple OS's in a workflow with a matrix](#multiple-oss-in-a-workflow-with-a-matrix)
  - [Using pip to get cache location](#using-pip-to-get-cache-location)
- [Python - pipenv](#python---pipenv)
- [R - renv](#r---renv)
- [Ruby - Bundler](#ruby---bundler)
- [Rust - Cargo](#rust---cargo)
- [Scala - SBT](#scala---sbt)
- [Swift, Objective-C - Carthage](#swift-objective-c---carthage)
- [Swift, Objective-C - CocoaPods](#swift-objective-c---cocoapods)
- [Swift - Swift Package Manager](#swift---swift-package-manager)
- [Swift - Mint](#swift---mint)
- [* - Bazel](#---bazel)

## C# - NuGet

Using [NuGet lock files](https://docs.microsoft.com/nuget/consume-packages/package-references-in-project-files#locking-dependencies):

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
    restore-keys: |
      ${{ runner.os }}-nuget-
```

Depending on the environment, huge packages might be pre-installed in the global cache folder.
With `actions/cache@v4` you can now exclude unwanted packages with [exclude pattern](https://github.com/actions/toolkit/tree/main/packages/glob#exclude-patterns)

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.nuget/packages
      !~/.nuget/packages/unwanted
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
    restore-keys: |
      ${{ runner.os }}-nuget-
```

Or you could move the cache folder like below.
> **Note** This workflow does not work for projects that require files to be placed in user profile package folder

```yaml
env:
  NUGET_PACKAGES: ${{ github.workspace }}/.nuget/packages
steps:
  - uses: actions/cache@v4
    with:
      path: ${{ github.workspace }}/.nuget/packages
      key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
      restore-keys: |
        ${{ runner.os }}-nuget-
```

## Clojure - Lein Deps

```yaml
- name: Cache lein project dependencies
  uses: actions/cache@v4
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-clojure-${{ hashFiles('**/project.clj') }}
    restore-keys: |
      ${{ runner.os }}-clojure
```


## D - DUB

### POSIX

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.dub
    key: ${{ runner.os }}-dub-${{ hashFiles('**/dub.selections.json') }}
    restore-keys: |
      ${{ runner.os }}-dub-
```

### Windows

```yaml
- uses: actions/cache@v4
  with:
    path: ~\AppData\Local\dub
    key: ${{ runner.os }}-dub-${{ hashFiles('**/dub.selections.json') }}
    restore-keys: |
      ${{ runner.os }}-dub-
```

## Deno

### Linux

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.deno
      ~/.cache/deno
    key: ${{ runner.os }}-deno-${{ hashFiles('**/deps.ts') }}
```

### macOS

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.deno
      ~/Library/Caches/deno
    key: ${{ runner.os }}-deno-${{ hashFiles('**/deps.ts') }}
```

### Windows

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~\.deno
      ~\AppData\Local\deno
    key: ${{ runner.os }}-deno-${{ hashFiles('**/deps.ts') }}
```

## Elixir - Mix

```yaml
- uses: actions/cache@v4
  with:
    path: |
      deps
      _build
    key: ${{ runner.os }}-mix-${{ hashFiles('**/mix.lock') }}
    restore-keys: |
      ${{ runner.os }}-mix-
```

## Erlang - Rebar3
```yaml
- uses: actions/cache@v2
  with:
    path: |
      ~/.cache/rebar3
      _build
    key: ${{ runner.os }}-erlang-${{ env.OTP_VERSION }}-${{ hashFiles('**/*rebar.lock') }}
    restore-keys: |
      ${{ runner.os }}-erlang-${{ env.OTP_VERSION }}-
```

## Go - Modules

### Linux

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cache/go-build
      ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

### macOS

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/Library/Caches/go-build
      ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

### Windows

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~\AppData\Local\go-build
      ~\go\pkg\mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

## Haskell - Cabal

We cache the elements of the Cabal store separately, as the entirety of `~/.cabal` can grow very large for projects with many dependencies.

```yaml
- name: Cache ~/.cabal/packages, ~/.cabal/store and dist-newstyle
  uses: actions/cache@v4
  with:
    path: |
      ~/.cabal/packages
      ~/.cabal/store
      dist-newstyle
    key: ${{ runner.os }}-${{ matrix.ghc }}-${{ hashFiles('**/*.cabal', '**/cabal.project', '**/cabal.project.freeze') }}
    restore-keys: ${{ runner.os }}-${{ matrix.ghc }}-
```

## Haskell - Stack

### Linux or macOS

```yaml
- uses: actions/cache@v4
  name: Cache ~/.stack
  with:
    path: ~/.stack
    key: ${{ runner.os }}-stack-global-${{ hashFiles('stack.yaml') }}-${{ hashFiles('package.yaml') }}
    restore-keys: |
      ${{ runner.os }}-stack-global-
- uses: actions/cache@v4
  name: Cache .stack-work
  with:
    path: .stack-work
    key: ${{ runner.os }}-stack-work-${{ hashFiles('stack.yaml') }}-${{ hashFiles('package.yaml') }}-${{ hashFiles('**/*.hs') }}
    restore-keys: |
      ${{ runner.os }}-stack-work-
```

### Windows

```yaml
- uses: actions/cache@v4
  name: Cache %APPDATA%\stack %LOCALAPPDATA%\Programs\stack
  with:
    path: |
      ~\AppData\Roaming\stack
      ~\AppData\Local\Programs\stack    
    key: ${{ runner.os }}-stack-global-${{ hashFiles('stack.yaml') }}-${{ hashFiles('package.yaml') }}
    restore-keys: |
      ${{ runner.os }}-stack-global-
- uses: actions/cache@v4
  name: Cache .stack-work
  with:
    path: .stack-work
    key: ${{ runner.os }}-stack-work-${{ hashFiles('stack.yaml') }}-${{ hashFiles('package.yaml') }}-${{ hashFiles('**/*.hs') }}
    restore-keys: |
      ${{ runner.os }}-stack-work-
```

## Java - Gradle

> **Note** Ensure no Gradle daemons are running anymore when your workflow completes. Creating the cache package might fail due to locks being held by Gradle. Refer to the [Gradle Daemon documentation](https://docs.gradle.org/current/userguide/gradle_daemon.html) on how to disable or stop the Gradle Daemons.

```yaml
- uses: actions/cache@v4
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
  uses: actions/cache@v4
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
    restore-keys: |
      ${{ runner.os }}-maven-
```

## Node - npm

For npm, cache files are stored in `~/.npm` on Posix, or `~\AppData\npm-cache` on Windows, but it's possible to use `npm config get cache` to find the path on any platform. See [the npm docs](https://docs.npmjs.com/cli/cache#cache) for more details.

If using `npm config` to retrieve the cache directory, ensure you run [actions/setup-node](https://github.com/actions/setup-node) first to ensure your `npm` version is correct.
After [deprecation](https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/) of save-state and set-output commands, the correct way to set output is using `${GITHUB_OUTPUT}`. For linux, we can use `${GITHUB_OUTPUT}` whereas for windows we need to use `${env:GITHUB_OUTPUT}` due to two different default shells in these two different OS ie `bash` and `pwsh` respectively.

> **Note** It is not recommended to cache `node_modules`, as it can break across Node versions and won't work with `npm ci`

### **Get npm cache directory using same shell**
### Bash shell
```yaml
- name: Get npm cache directory
  id: npm-cache-dir
  shell: bash
  run: echo "dir=$(npm config get cache)" >> ${GITHUB_OUTPUT}
```

### PWSH shell
```yaml
- name: Get npm cache directory
  id: npm-cache-dir
  shell: pwsh
  run: echo "dir=$(npm config get cache)" >> ${env:GITHUB_OUTPUT}
```
`Get npm cache directory` step can then be used with `actions/cache` as shown below

```yaml
- uses: actions/cache@v4
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
  uses: actions/cache@v4
  with:
    path: '**/node_modules'
    key: ${{ runner.os }}-${{ hashFiles('**/yarn.lock') }}
```

## Node - Yarn
The yarn cache directory will depend on your operating system and version of `yarn`. See https://yarnpkg.com/lang/en/docs/cli/cache/ for more info.

```yaml
- name: Get yarn cache directory path
  id: yarn-cache-dir-path
  run: echo "dir=$(yarn cache dir)" >> $GITHUB_OUTPUT

- uses: actions/cache@v4
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
  run: echo "dir=$(yarn config get cacheFolder)" >> $GITHUB_OUTPUT

- uses: actions/cache@v4
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
      uses: actions/cache@v4
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
    echo "dir=$(composer config cache-files-dir)" >> $GITHUB_OUTPUT
- uses: actions/cache@v4
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
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

Replace `~/.cache/pip` with the correct `path` if not using Ubuntu.

### Multiple OS's in a workflow

```yaml
- uses: actions/cache@v4
  if: startsWith(runner.os, 'Linux')
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

- uses: actions/cache@v4
  if: startsWith(runner.os, 'macOS')
  with:
    path: ~/Library/Caches/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

- uses: actions/cache@v4
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
    - uses: actions/cache@v4
      with:
        path: ${{ matrix.path }}
        key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
        restore-keys: |
         ${{ runner.os }}-pip-
```

### Using pip to get cache location

> **Note** This requires pip 20.1+
```yaml
- name: Get pip cache dir
  id: pip-cache
  shell: bash
  run: |
    echo "dir=$(pip cache dir)" >> $GITHUB_OUTPUT

- name: pip cache
  uses: actions/cache@v4
  with:
    path: ${{ steps.pip-cache.outputs.dir }}
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

## Python - pipenv

```yaml
- name: Set up Python
  # The actions/cache step below uses this id to get the exact python version
  id: setup-python
  uses: actions/setup-python@v2

  ⋮

- uses: actions/cache@v4
  with:
    path: ~/.local/share/virtualenvs
    key: ${{ runner.os }}-python-${{ steps.setup-python.outputs.python-version }}-pipenv-${{ hashFiles('Pipfile.lock') }}
```

## R - renv

For renv, the cache directory will vary by OS. The `RENV_PATHS_ROOT` environment variable is used to set the cache location. Have a look at https://rstudio.github.io/renv/reference/paths.html#details for more details.

```yaml
- name: Set RENV_PATHS_ROOT
  shell: bash
  run: |
    echo "RENV_PATHS_ROOT=${{ runner.temp }}/renv" >> $GITHUB_ENV
- name: Install and activate renv
  run: |
    install.packages("renv")
    renv::activate()
  shell: Rscript {0}
- name: Get R and OS version
  id: get-version
  run: |
    cat("##[set-output name=os-version;]", sessionInfo()$running, "\n", sep = "")
    cat("##[set-output name=r-version;]", R.Version()$version.string, sep = "")
  shell: Rscript {0}
- name: Restore Renv package cache
  uses: actions/cache@v4
  with:
    path: ${{ env.RENV_PATHS_ROOT }}
    key: ${{ steps.get-version.outputs.os-version }}-${{ steps.get-version.outputs.r-version }}-${{ inputs.cache-version }}-${{ hashFiles('renv.lock') }}
    restore-keys: ${{ steps.get-version.outputs.os-version }}-${{ steps.get-version.outputs.r-version }}-${{inputs.cache-version }}-
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
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/bin/
      ~/.cargo/registry/index/
      ~/.cargo/registry/cache/
      ~/.cargo/git/db/
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

## Scala - SBT

```yaml
- name: Cache SBT
  uses: actions/cache@v4
  with:
    path: |
      ~/.ivy2/cache
      ~/.sbt
    key: ${{ runner.os }}-sbt-${{ hashFiles('**/build.sbt') }}
```

## Swift, Objective-C - Carthage

```yaml
- uses: actions/cache@v4
  with:
    path: Carthage
    key: ${{ runner.os }}-carthage-${{ hashFiles('**/Cartfile.resolved') }}
    restore-keys: |
      ${{ runner.os }}-carthage-
```

## Swift, Objective-C - CocoaPods

```yaml
- uses: actions/cache@v4
  with:
    path: Pods
    key: ${{ runner.os }}-pods-${{ hashFiles('**/Podfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-pods-
```

## Swift - Swift Package Manager

```yaml
- uses: actions/cache@v4
  with:
    path: .build
    key: ${{ runner.os }}-spm-${{ hashFiles('**/Package.resolved') }}
    restore-keys: |
      ${{ runner.os }}-spm-
```

## Swift - Mint

```yaml
env:
  MINT_PATH: .mint/lib
  MINT_LINK_PATH: .mint/bin
steps:
  - uses: actions/cache@v4
    with:
      path: .mint
      key: ${{ runner.os }}-mint-${{ hashFiles('**/Mintfile') }}
      restore-keys: |
        ${{ runner.os }}-mint-
```

## * - Bazel

[`bazelisk`](https://github.com/bazelbuild/bazelisk) does not have be to separately downloaded and installed because it's already included in GitHub's `ubuntu-latest` and `macos-latest` base images.

### Linux

```yaml
- name: Cache Bazel
  uses: actions/cache@v4
  with:
    path: |
      ~/.cache/bazel
    key: ${{ runner.os }}-bazel-${{ hashFiles('.bazelversion', '.bazelrc', 'WORKSPACE', 'WORKSPACE.bazel', 'MODULE.bazel') }}
    restore-keys: |
      ${{ runner.os }}-bazel-
- run: bazelisk test //...
```

### macOS

```yaml
- name: Cache Bazel
  uses: actions/cache@v4
  with:
    path: |
      /private/var/tmp/_bazel_runner/
    key: ${{ runner.os }}-bazel-${{ hashFiles('.bazelversion', '.bazelrc', 'WORKSPACE', 'WORKSPACE.bazel', 'MODULE.bazel') }}
    restore-keys: |
      ${{ runner.os }}-bazel-
- run: bazelisk test //...
```
