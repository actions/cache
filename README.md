# cache

This action allows caching dependencies and build outputs to improve workflow execution time.

[![Tests](https://github.com/actions/cache/actions/workflows/workflow.yml/badge.svg)](https://github.com/actions/cache/actions/workflows/workflow.yml)

## Documentation

See ["Caching dependencies to speed up workflows"](https://help.github.com/github/automating-your-workflow-with-github-actions/caching-dependencies-to-speed-up-workflows).

## What's New
### v3
* Fixed download issue for files > 2GB during restore.
* Updated the minimum runner version support from node 12 -> node 16.

### v2
* Increased the cache size limit to 10 GB.
* Added support for multiple paths, [glob patterns](https://github.com/actions/toolkit/tree/main/packages/glob), and single file caches.

```yaml
- name: Cache multiple paths
  uses: actions/cache@v3
  with:
    path: |
      ~/cache
      !~/cache/exclude
    key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

* Increased performance and improved cache sizes using `zstd` compression for Linux and macOS runners
* Allowed caching for all events with a ref. See [events that trigger workflow](https://help.github.com/en/actions/reference/events-that-trigger-workflows) for info on which events do not have a `GITHUB_REF`
* Released the [`@actions/cache`](https://github.com/actions/toolkit/tree/main/packages/cache) npm package to allow other actions to utilize caching
* Added a best-effort cleanup step to delete the archive after extraction to reduce storage space

Refer [here](https://github.com/actions/cache/blob/v1/README.md) for previous versions

## Usage

### Pre-requisites
Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

If you are using this inside a container, a POSIX-compliant `tar` needs to be included and accessible in the execution path.

### Inputs

* `path` - A list of files, directories, and wildcard patterns to cache and restore. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `key` - An explicit key for restoring and saving the cache
* `restore-keys` - An ordered list of keys to use for restoring the cache if no cache hit occurred for key

### Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key

> See [Skipping steps based on cache-hit](#Skipping-steps-based-on-cache-hit) for info on using this output

### Cache scopes
The cache is scoped to the key and branch. The default branch cache is available to other branches.

See [Matching a cache key](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) for more info.

### Example workflow

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Cache Primes
      id: cache-primes
      uses: actions/cache@v3
      with:
        path: prime-numbers
        key: ${{ runner.os }}-primes

    - name: Generate Prime Numbers
      if: steps.cache-primes.outputs.cache-hit != 'true'
      run: /generate-primes.sh -d prime-numbers

    - name: Use Prime Numbers
      run: /primes.sh -d prime-numbers
```

## Implementation Examples

Every programming language and framework has its own way of caching.

See [Examples](examples.md) for a list of `actions/cache` implementations for use with:

- [C# - NuGet](./examples.md#c---nuget)
- [D - DUB](./examples.md#d---dub)
- [Deno](./examples.md#deno)
- [Elixir - Mix](./examples.md#elixir---mix)
- [Go - Modules](./examples.md#go---modules)
- [Haskell - Cabal](./examples.md#haskell---cabal)
- [Haskell - Stack](./examples.md#haskell---stack)
- [Java - Gradle](./examples.md#java---gradle)
- [Java - Maven](./examples.md#java---maven)
- [Node - npm](./examples.md#node---npm)
- [Node - Lerna](./examples.md#node---lerna)
- [Node - Yarn](./examples.md#node---yarn)
- [OCaml/Reason - esy](./examples.md#ocamlreason---esy)
- [PHP - Composer](./examples.md#php---composer)
- [Python - pip](./examples.md#python---pip)
- [Python - pipenv](./examples.md#python---pipenv)
- [R - renv](./examples.md#r---renv)
- [Ruby - Bundler](./examples.md#ruby---bundler)
- [Rust - Cargo](./examples.md#rust---cargo)
- [Scala - SBT](./examples.md#scala---sbt)
- [Swift, Objective-C - Carthage](./examples.md#swift-objective-c---carthage)
- [Swift, Objective-C - CocoaPods](./examples.md#swift-objective-c---cocoapods)
- [Swift - Swift Package Manager](./examples.md#swift---swift-package-manager)

## Creating a cache key

A cache key can include any of the contexts, functions, literals, and operators supported by GitHub Actions.

For example, using the [`hashFiles`](https://help.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#hashfiles) function allows you to create a new cache when dependencies change.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

Additionally, you can use arbitrary command output in a cache key, such as a date or software version:

```yaml
  # http://man7.org/linux/man-pages/man1/date.1.html
  - name: Get Date
    id: get-date
    run: |
      echo "::set-output name=date::$(/bin/date -u "+%Y%m%d")"
    shell: bash

  - uses: actions/cache@v3
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ steps.get-date.outputs.date }}-${{ hashFiles('**/lockfiles') }}
```

See [Using contexts to create cache keys](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#using-contexts-to-create-cache-keys)

## Cache Limits

A repository can have up to 10GB of caches. Once the 10GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.

## Skipping steps based on cache-hit

Using the `cache-hit` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the key.

Example:
```yaml
steps:
  - uses: actions/checkout@v2

  - uses: actions/cache@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh
```

> Note: The `id` defined in `actions/cache` must match the `id` in the `if` statement (i.e. `steps.[ID].outputs.cache-hit`)

## Known limitation

- `action/cache` is currently not supported on GitHub Enterprise Server. <https://github.com/github/roadmap/issues/273> is tracking this.

Since GitHub Enterprise Server uses self-hosted runners, dependencies are typically cached on the runner by whatever dependency management tool is being used (npm, maven, etc.).  This eliminates the need for explicit caching in some scenarios.

## Changelog schedule and history

| Status  | Version  | Date  | Highlights  |
|:---|:---|:---|:---|
| Published  | v3.0.0  | Mar 21st, 2022 | -  Updated minimum runner version support from node 12 -> node 16 <br>  |

## Contributing
We would love for you to contribute to `actions/cache`, pull requests are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License
The scripts and documentation in this project are released under the [MIT License](LICENSE)
