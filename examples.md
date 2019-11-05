# Examples

- [C# - Nuget](#c---nuget)
- [Elixir - Mix](#elixir---mix)
- [Go - Modules](#go---modules)
- [Java - Gradle](#java---gradle)
- [Java - Maven](#java---maven)
- [Node - npm](#node---npm)
- [Node - Yarn](#node---yarn)
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
