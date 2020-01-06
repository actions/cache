# Examples

- [C# - NuGet](#c---nuget)
- [Elixir - Mix](#elixir---mix)
- [Go - Modules](#go---modules)
- [Java - Gradle](#java---gradle)
- [Java - Maven](#java---maven)
- [Node - npm](#node---npm)
- [Node - Yarn](#node---yarn)
- [PHP - Composer](#php---composer)
- [Python - pip](#python---pip)
- [Ruby - Gem](#ruby---gem)
- [Rust - Cargo](#rust---cargo)
- [Swift, Objective-C - Carthage](#swift-objective-c---carthage)
- [Swift, Objective-C - CocoaPods](#swift-objective-c---cocoapods)

## C# - NuGet
Using [NuGet lock files](https://docs.microsoft.com/nuget/consume-packages/package-references-in-project-files#locking-dependencies):

```yaml
- uses: actions/cache@v1
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
    restore-keys: |
      ${{ runner.os }}-nuget-
```

Depending on the environment, huge packages might be pre-installed in the global cache folder.
If you do not want to include them, consider to move the cache folder like below.
>Note: This workflow does not work for projects that require files to be placed in user profile package folder
```yaml
env:
  NUGET_PACKAGES: ${{ github.workspace }}/.nuget/packages
steps:
  - uses: actions/cache@v1
    with:
      path: ${{ github.workspace }}/.nuget/packages
      key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
      restore-keys: |
        ${{ runner.os }}-nuget-
```

## Elixir - Mix
```yaml
- uses: actions/cache@v1
  with:
    path: deps
    key: ${{ runner.os }}-mix-${{ hashFiles(format('{0}{1}', github.workspace, '/mix.lock')) }}
    restore-keys: |
      ${{ runner.os }}-mix-
```

## Go - Modules

```yaml
- uses: actions/cache@v1
  with:
    path: ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

## Java - Gradle

```yaml
- uses: actions/cache@v1
  with:
    path: ~/.gradle/caches
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle') }}
    restore-keys: |
      ${{ runner.os }}-gradle-
```

## Java - Maven

```yaml
- uses: actions/cache@v1
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
    restore-keys: |
      ${{ runner.os }}-maven-
```

## Node - npm

For npm, cache files are stored in `~/.npm` on Posix, or `%AppData%/npm-cache` on Windows. See https://docs.npmjs.com/cli/cache#cache

>Note: It is not recommended to cache `node_modules`, as it can break across Node versions and won't work with `npm ci`

### macOS and Ubuntu

```yaml
- uses: actions/cache@v1
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Windows

```yaml
- uses: actions/cache@v1
  with:
    path: ~\AppData\Roaming\npm-cache
    key: ${{ runner.os }}-node-${{ hashFiles('**\package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

### Using multiple systems and `npm config`

```yaml  
- name: Get npm cache directory
  id: npm-cache
  run: |
    echo "::set-output name=dir::$(npm config get cache)"
- uses: actions/cache@v1
  with:
    path: ${{ steps.npm-cache.outputs.dir }}
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## Node - Yarn
The yarn cache directory will depend on your operating system and version of `yarn`. See https://yarnpkg.com/lang/en/docs/cli/cache/ for more info.

```yaml
- name: Get yarn cache
  id: yarn-cache
  run: echo "::set-output name=dir::$(yarn cache dir)"

- uses: actions/cache@v1
  with:
    path: ${{ steps.yarn-cache.outputs.dir }}
    key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      ${{ runner.os }}-yarn-
```

## PHP - Composer

```yaml  
- name: Get Composer Cache Directory
  id: composer-cache
  run: |
    echo "::set-output name=dir::$(composer config cache-files-dir)"
- uses: actions/cache@v1
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
- uses: actions/cache@v1
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

Replace `~/.cache/pip` with the correct `path` if not using Ubuntu.

### Multiple OS's in a workflow

```yaml
- uses: actions/cache@v1
  if: startsWith(runner.os, 'Linux')
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

- uses: actions/cache@v1
  if: startsWith(runner.os, 'macOS')
  with:
    path: ~/Library/Caches/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-

- uses: actions/cache@v1
  if: startsWith(runner.os, 'Windows')
  with:
    path: ~\AppData\Local\pip\Cache
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

### Using a script to get cache location

> Note: This uses an internal pip API and may not always work
```yaml
- name: Get pip cache
   id: pip-cache
   run: |
     python -c "from pip._internal.locations import USER_CACHE_DIR; print('::set-output name=dir::' + USER_CACHE_DIR)"

- uses: actions/cache@v1
  with:
    path: ${{ steps.pip-cache.outputs.dir }}
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

## Ruby - Gem

```yaml
- uses: actions/cache@v1
  with:
    path: vendor/bundle
    key: ${{ runner.os }}-gem-${{ hashFiles('**/Gemfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-gem-
```
When dependencies are installed later in the workflow, we must specify the same path for the bundler.

```yaml
- name: Bundle install
  run: |
    bundle config path vendor/bundle
    bundle install --jobs 4 --retry 3
```

## Rust - Cargo

```yaml
- name: Cache cargo registry
  uses: actions/cache@v1
  with:
    path: ~/.cargo/registry
    key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}
- name: Cache cargo index
  uses: actions/cache@v1
  with:
    path: ~/.cargo/git
    key: ${{ runner.os }}-cargo-index-${{ hashFiles('**/Cargo.lock') }}
- name: Cache cargo build
  uses: actions/cache@v1
  with:
    path: target
    key: ${{ runner.os }}-cargo-build-target-${{ hashFiles('**/Cargo.lock') }}
```

## Swift, Objective-C - Carthage

```yaml
- uses: actions/cache@v1
  with:
    path: Carthage
    key: ${{ runner.os }}-carthage-${{ hashFiles('**/Cartfile.resolved') }}
    restore-keys: |
      ${{ runner.os }}-carthage-
```

## Swift, Objective-C - CocoaPods

```yaml
- uses: actions/cache@v1
  with:
    path: Pods
    key: ${{ runner.os }}-pods-${{ hashFiles('**/Podfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-pods-
```
