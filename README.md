# cache

This action allows caching dependencies and build outputs to improve workflow execution time.

<a href="https://github.com/actions/cache/actions?query=workflow%3ATests"><img alt="GitHub Actions status" src="https://github.com/actions/cache/workflows/Tests/badge.svg?branch=master&event=push"></a>

## Documentation

See ["Caching dependencies to speed up workflows"](https://help.github.com/github/automating-your-workflow-with-github-actions/caching-dependencies-to-speed-up-workflows).

## Usage

### Pre-requisites
Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Inputs

* `path` - A directory to store and save the cache
* `key` - An explicit key for restoring and saving the cache
* `restore-keys` - An ordered list of keys to use for restoring the cache if no cache hit occurred for key

### Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key

> See [Skipping steps based on cache-hit](#Skipping-steps-based-on-cache-hit) for info on using this output

### Example workflow

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v1

    - name: Cache Primes
      id: cache-primes
      uses: actions/cache@v1
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

- [C# - Nuget](./examples.md#c---nuget)
- [Elixir - Mix](./examples.md#elixir---mix)
- [Go - Modules](./examples.md#go---modules)
- [Haskell - Cabal](./examples.md#haskell---cabal)
- [Haskell - Stack](./examples.md#haskell---stack)
- [Java - Gradle](./examples.md#java---gradle)
- [Java - Maven](./examples.md#java---maven)
- [Node - npm](./examples.md#node---npm)
- [Node - Yarn](./examples.md#node---yarn)
- [OCaml/Reason - esy](./examples.md##ocamlreason---esy)
- [PHP - Composer](./examples.md#php---composer)
- [Python - pip](./examples.md#python---pip)
- [R - renv](./examples.md#r---renv)
- [Ruby - Bundler](./examples.md#ruby---bundler)
- [Rust - Cargo](./examples.md#rust---cargo)
- [Scala - SBT](./examples.md#scala---sbt)
- [Swift, Objective-C - Carthage](./examples.md#swift-objective-c---carthage)
- [Swift, Objective-C - CocoaPods](./examples.md#swift-objective-c---cocoapods)
- [Swift - Swift Package Manager](./examples.md#swift---swift-package-manager)

## Cache Limits

A repository can have up to 5GB of caches. Once the 5GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.

## Skipping steps based on cache-hit

Using the `cache-hit` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the key.

Example:
```yaml
steps:
  - uses: actions/checkout@v2

  - uses: actions/cache@v1
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh
```

> Note: The `id` defined in `actions/cache` must match the `id` in the `if` statement (i.e. `steps.[ID].outputs.cache-hit`)

## Contributing
We would love for you to contribute to `@actions/cache`, pull requests are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License
The scripts and documentation in this project are released under the [MIT License](LICENSE)
