# Examples

- [C# - Nuget](#c---nuget)
- [Docker](#docker)
- [Elixir - Mix](#elixir---mix)
- [Go - Modules](#go---modules)
- [Java - Gradle](#java---gradle)
- [Java - Maven](#java---maven)
- [Node - npm](#node---npm)
- [Node - Yarn](#node---yarn)
- [PHP - Composer](#php---composer)
- [Ruby - Gem](#ruby---gem)
- [Rust - Cargo](#rust---cargo)
- [Swift, Objective-C - Carthage](#swift-objective-c---carthage)
- [Swift, Objective-C - CocoaPods](#swift-objective-c---cocoapods)

## C# - Nuget
Using [NuGet lock files](https://docs.microsoft.com/nuget/consume-packages/package-references-in-project-files#locking-dependencies):

```yaml
- uses: actions/cache@v1
  with:
    path: ~/.nuget/packages
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

```yaml
- uses: actions/cache@v1
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## Node - Yarn

```yaml
- uses: actions/cache@v1
  with:
    path: ~/.cache/yarn
    key: ${{ runner.os }}-yarn-${{ hashFiles(format('{0}{1}', github.workspace, '/yarn.lock')) }}
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

## Ruby - Gem

```yaml
- uses: actions/cache@v1
  with:
    path: vendor/bundle
    key: ${{ runner.os }}-gem-${{ hashFiles('**/Gemfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-gem-
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

## Docker

```yaml
- uses: actions/cache@v1
  id: cache
  with:
    path: docker-cache
    key: ${{ runner.os }}-docker-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-docker-
- name: Load cached Docker layers
  run: |
    if [ -d "docker-cache" ]; then
      cat docker-cache/x* > my-image.tar
      docker load < my-image.tar
      rm -fr docker-cache
    fi
- name: Build image
  if: steps.cache.outputs.cache-hit != 'true'
  run: |
    docker build --cache-from my-image -t my-image .
    docker save my-image $(docker history -q my-image | awk '!/<missing>/{print}') > my-image.tar
    mkdir docker-cache
    split -b 100m my-image.tar docker-cache/x
```
