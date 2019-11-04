# Examples

- [Node - npm](#node---npm)
- [Node - Yarn](#node---yarn)
- [C# - Nuget](#c---nuget)
- [Java - Gradle](#java---gradle)
- [Java - Maven](#java---maven)
- [Swift, Objective-C - Carthage](#swift-objective-c---carthage)
- [Swift, Objective-C - CocoaPods](#swift-objective-c---cocoapods)
- [Ruby - Gem](#ruby---gem)
- [Go - Modules](#go---modules)
- [Elixir - Mix](#elixir---mix)
- [Rust - Cargo](#rust---cargo)

## Node - npm

```yaml
- uses: actions/cache@preview
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## Node - Yarn

```yaml
- uses: actions/cache@preview
  with:
    path: ~/.cache/yarn
    key: ${{ runner.os }}-yarn-${{ hashFiles(format('{0}{1}', github.workspace, '/yarn.lock')) }}
    restore-keys: |
      ${{ runner.os }}-yarn-
```

## C# - Nuget
Using [NuGet lock files](https://docs.microsoft.com/nuget/consume-packages/package-references-in-project-files#locking-dependencies):
```yaml
- uses: actions/cache@preview
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
    restore-keys: |
      ${{ runner.os }}-nuget-
```

## Java - Gradle

```yaml
- uses: actions/cache@preview
  with:
    path: ~/.gradle/caches
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle') }}
    restore-keys: |
      ${{ runner.os }}-gradle-
```

## Java - Maven

```yaml
- uses: actions/cache@preview
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
    restore-keys: |
      ${{ runner.os }}-maven-
```

## Swift, Objective-C - Carthage

```yaml
uses: actions/cache@preview
      with:
        path: Carthage
        key: ${{ runner.os }}-carthage-${{ hashFiles('**/Cartfile.resolved') }}
        restore-keys: |
          ${{ runner.os }}-carthage-
```

## Swift, Objective-C - CocoaPods

```yaml
- uses: actions/cache@preview
  with:
    path: Pods
    key: ${{ runner.os }}-pods-${{ hashFiles('**/Podfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-pods-
```

## Ruby - Gem

```yaml
- uses: actions/cache@preview
  with:
    path: vendor/bundle
    key: ${{ runner.os }}-gem-${{ hashFiles('**/Gemfile.lock') }}
    restore-keys: |
      ${{ runner.os }}-gem-
```

## Go - Modules

```yaml
- uses: actions/cache@preview
  with:
    path: ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      ${{ runner.os }}-go-
```

## Elixir - Mix
```yaml
- uses: actions/cache@preview
  with:
    path: deps
    key: ${{ runner.os }}-mix-${{ hashFiles(format('{0}{1}', github.workspace, '/mix.lock')) }}
    restore-keys: |
      ${{ runner.os }}-mix-
```

## Rust - Cargo

```
- name: Cache cargo registry
  uses: actions/cache@preview
  with:
    path: ~/.cargo/registry
    key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}
- name: Cache cargo index
  uses: actions/cache@preview
  with:
    path: ~/.cargo/git
    key: ${{ runner.os }}-cargo-index-${{ hashFiles('**/Cargo.lock') }}
- name: Cache cargo build
  uses: actions/cache@preview
  with:
    path: target
    key: ${{ runner.os }}-cargo-build-target-${{ hashFiles('**/Cargo.lock') }}
```
