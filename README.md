# cache

This action allows caching dependencies and build outputs to improve workflow execution time.

[![Tests](https://github.com/actions/cache/actions/workflows/workflow.yml/badge.svg)](https://github.com/actions/cache/actions/workflows/workflow.yml)

## Documentation

See ["Caching dependencies to speed up workflows"](https://help.github.com/github/automating-your-workflow-with-github-actions/caching-dependencies-to-speed-up-workflows).

## What's New
### v3
* Added support for caching from GHES 3.5.
* Fixed download issue for files > 2GB during restore.
* Updated the minimum runner version support from node 12 -> node 16.
* Fixed avoiding empty cache save when no files are available for caching.
* Fixed tar creation error while trying to create tar with path as `~/` home folder on `ubuntu-latest`.
* Fixed zstd failing on amazon linux 2.0 runners.
* Fixed cache not working with github workspace directory or current directory.
* Fixed the download stuck problem by introducing a timeout of 1 hour for cache downloads.
* Fix zstd not working for windows on gnu tar in issues.
* Allowing users to provide a custom timeout as input for aborting download of a cache segment using an environment variable `SEGMENT_DOWNLOAD_TIMEOUT_MIN`. Default is 60 minutes.

Refer [here](https://github.com/actions/cache/blob/v2/README.md) for previous versions

## Usage

### Pre-requisites
Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

If you are using this inside a container, a POSIX-compliant `tar` needs to be included and accessible in the execution path.

### Inputs

* `path` - A list of files, directories, and wildcard patterns to cache and restore. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `key` - An explicit key for restoring and saving the cache
* `restore-keys` - An ordered list of keys to use for restoring stale cache if no cache hit occurred for key. Note
`cache-hit` returns false in this case.

#### Environment Variables
* `SEGMENT_DOWNLOAD_TIMEOUT_MIN` - Segment download timeout (in minutes, default `60`) to abort download of the segment if not completed in the defined number of minutes. [Read more](#cache-segment-restore-timeout)

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
    - uses: actions/checkout@v3

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

> Note: You must use the `cache` action in your workflow before you need to use the files that might be restored from the cache. If the provided `key` doesn't match an existing cache, a new cache is automatically created if the job completes successfully.

## Implementation Examples

Every programming language and framework has its own way of caching.

See [Examples](examples.md) for a list of `actions/cache` implementations for use with:

- [C# - NuGet](./examples.md#c---nuget)
- [Clojure - Lein Deps](./examples.md#clojure---lein-deps)
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
  - uses: actions/checkout@v3

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


## Cache Version
Cache version is unique for a combination of compression tool used for compression of cache (Gzip, Zstd, etc based on runner OS) and the path of directories being cached. If two caches have different versions, they are identified as unique cache entries. This also means that a cache created on `windows-latest` runner can't be restored on `ubuntu-latest` as cache `Version`s are different. 

Example: Below example will create 3 unique caches with same keys. Ubuntu and windows runners will use different compression technique and hence create two different caches. And `build-linux` will create two different caches as the `paths` are different.

```yaml
jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Cache Primes
        id: cache-primes
        uses: actions/cache@v3
        with:
          path: prime-numbers
          key: primes

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d prime-numbers

      - name: Cache Numbers
        id: cache-numbers
        uses: actions/cache@v3
        with:
          path: numbers
          key: primes

      - name: Generate Numbers
        if: steps.cache-numbers.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d numbers

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Cache Primes
        id: cache-primes
        uses: actions/cache@v3
        with:
          path: prime-numbers
          key: primes

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes -d prime-numbers
```
## Cache segment restore timeout

A cache gets downloaded in multiple segments of fixed sizes (`1GB` for a `32-bit` runner and `2GB` for a `64-bit` runner). Sometimes, a segment download gets stuck which causes the workflow job to be stuck forever and fail. Version `v3.0.8` of `actions/cache` introduces a segment download timeout. The segment download timeout will allow the segment download to get aborted and hence allow the job to proceed with a cache miss.

Default value of this timeout is 60 minutes and can be customized by specifying an [environment variable](https://docs.github.com/en/actions/learn-github-actions/environment-variables) named `SEGMENT_DOWNLOAD_TIMEOUT_MINS` with timeout value in minutes.

## Known practices and workarounds
Following are some of the known practices/workarounds which community has used to fulfill specific requirements. You may choose to use them if suits your use case. Note these are not necessarily the only or the recommended solution.

#### Update a cache
A cache today is immutable and cannot be updated. But some use cases require the cache to be saved even though there was a "hit" during restore. To do so, use a `key` which is unique for every run and use `restore-keys` to restore the nearest cache. For example:
  ```
      - name: update cache on every commit
        uses: actions/cache@v3
        with:
          path: prime-numbers
          key: primes-${{ runner.os }}-${{ github.run_id }} # Can use time based key as well
          restore-keys: |
            primes-${{ runner.os }}
  ```          
  Please note that this will create a new cache on every run and hence will consume the cache [quota](#cache-limits).
  
#### Use cache across feature branches
Reusing cache across feature branches is not allowed today to provide cache [isolation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache). However if both feature branches are from the default branch, a good way to achieve this is to ensure that the default branch has a cache. This cache will then be consumable by both feature branches.

## Contributing
We would love for you to contribute to `actions/cache`, pull requests are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License
The scripts and documentation in this project are released under the [MIT License](LICENSE)
