# Cache Recipes

This document lists some of the strategies (and example workflows if possible) which can be used
- to solve some common use cases
- to effectively leverage the step inputs and outputs

## Actions Cache Basics

The cache action works using the following set of inputs and outputs as mentioned [here](https://github.com/actions/cache#inputs). However these inputs are self explaining below are some ways in which the inputs can be used in a better way.

### Keys

A `key`, also referred as `primary key` is a value with which cache is restored or saved. If cache is not found with the primary key, the same key is used to save the cache in the `actions/cache` action.
#### Static keys

```yaml
    - uses: actions/cache@v3
      with:
        key: static-key
```

In your workflows, you can use keys in a hardcoded manner. This way the same `key` will be saved once and restored till its evicted. In case the `key` gets evicted, cache with same `key` will be created again and saved.

#### Dynamic keys

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    - uses: actions/cache@v3
      with:
        key: ${{ runner.os }}-cache
```

In your workflows, if you wish to create OS specific caches, or caches based on the lockfiles, commit SHA, workflow run id, etc. then you can generate the keys dynamically at run-time. Below are some of the ways to use dynamically generated keys

**Cache key by lockfile**
One of the most common use case is to use hash for lockfile as key. This way same cache will be restored for same lockfiles until there's any change in the lockfile/dependencies.
```yaml
    key: cache-${{ hashFiles('**/lockfiles') }}
```

**Cache key by Operating system**
Caches can be stored separately for different Operating Systems. This can be used in combination with hashfiles in case multiple caches are being generated per OS. 
```yaml
    key: ${{ runner.os }}-cache
```

**Cache key by Workflow run id/attempt**
Caches scoped to the particular workflow run id or run attempt can be stored and referred by using the run id/attempt
```yaml
    key: cache-${{ github.run_id }}-${{ github.run_attempt }}
```

**Cache key by commit id** 
For very short term or isolated use cases, where cache is supposed to be short lived, commit sha can be used.
```yaml
    key: cache-${{ github.sha }}
```

**Cache key by combination of multiple options**
Cache key can be formed by combination of more than one metadata, evaluated info.
```yaml
    key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

The [GitHub Context](https://docs.github.com/en/actions/learn-github-actions/contexts#github-context) can be used to create keys using the workflows metadata.

### Restore keys

Restore keys are a set of keys that are looked for when cache with primary key is not found. The first matching cache is downloaded when restore keys are provided.

The restore keys can be provided as a complete name, or a prefix, read more [here](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) on how a cache key is matched using restore keys.

### Paths

The path(s) in the cache action define(s) the path/directory that needs to be cached. The directory can reside on the runner or containers inside runners. The path to dependencies can either be a fix path or a glob pattern that's matched with existing directory structure and evaluated at runtime. Refer [@actions/glob](https://github.com/actions/toolkit/tree/main/packages/glob#patterns) to get more information about the patterns.

Examples:

<!-- TODO: add all possible paths examples here along with any env vars / context vars-->

### Version

Cache version is a hash generated for a combination of compression tool used (Gzip, Zstd, etc. based on the runner OS) and the path of directories being cached. If two caches have different versions, they are identified as unique caches while matching. This for example, means that a cache created on `windows-latest` runner may not be restored on `ubuntu-latest` as cache versions could be different.

> TL;DR 
Version = hash(Compression tool, Path(s) to be cached)

### Branch

Whenever a cache is saved, the repository `branch` where it was generated is also stored along with it. This is done mainly to avoid caches from `feature` branches to interact with jobs running on the `default` branch. 

### Scope

The cache is scoped to a key, version and branch. The default branch cache is accessible to all other branches, but not the other way round. This means if you have a cache with key matching (completely or partially) and (exact) version in the default branch, you will be able to restore the cache in any of the branches. However if you create a cache in a feature branch, it cannot be restored in any other branch.
Refer [matching the key](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) for more info on how keys are matched and restored.

## Restore action

The [restore](https://github.com/actions/cache/tree/main/restore) action allows restoring cache for given key/path combination. The restore action works similar to the `actions/cache` action, except it doesn't save the cache by itself like the `cache` action does.

This action is useful in cases where we only need to restore the cache and not save it. 

**Usage**

```yaml
  - uses: actions/cache/restore@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

The `restore` action provides three outputs, `cache-hit`, `cache-primary-key` and `cache-matched-key`, more details [here](https://github.com/actions/cache/blob/main/restore/README.md#outputs).

### Make cache read only / Reuse cache from centralized job

In case you are using a centralized job to create and save your cache that can be reused by other jobs in your repository, this action will take care of your restore only needs and make the cache read-only.

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache/restore@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh

  - name: Build
    run: /build.sh

  - name: Publish package to public
    run: /publish.sh
```

### Exit workflow on cache miss

You can use the output of this action to exit the workflow on cache miss. This way you can restrict your workflow to only initiate the build when `cache-hit` occurs, in other words, cache with exact key is found.

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache/restore@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Check cache hit
    if: steps.cache.outputs.cache-hit != 'true'
    run: exit 1

  - name: Build
    run: /build.sh
```

## Save action

**Usage**

```yaml
  - uses: actions/cache/save@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

### Re-evaluate cache key while saving

With save action, the key can now be re-evaluated while executing the action. This helps in cases where the lockfiles are generated during the build.

Let's say we have a restore step that computes key at runtime

```yaml
uses: actions/cache/restore@v3
id: restore-cache
with:
    key: cache-${{ hashFiles('**/lockfiles') }}
```

Case 1: Where an user would want to reuse the key as it is
```yaml
uses: actions/cache/save@v3
with:
    key: ${{ steps.restore-cache.outputs.key }}
```

Case 2: Where the user would want to re-evaluate the key
```yaml
uses: actions/cache/save@v3
with:
    key: npm-cache-${{hashfiles(package-lock.json)}}
```

### Always save cache

There are instances where some flaky test cases would fail the entire workflow and users would get frustrated because the builds would run for hours and the cache couldn't get saved as the workflow failed in between. For such use-cases, users would now have the ability to use `actions/cache/save` action to save the cache by using `if: always()` condition. This way the cache will always be saved if generated, or a warning will be thrown that nothing is found on the cache path. Users can also use the `if` condition to only execute the `actions/cache/save` action depending on the output of the previous steps. This way they get more control on when to save the cache.

```yaml
steps:
  - uses: actions/checkout@v3
  .
  . // restore if need be
  .
  - name: Build
    run: /build.sh
  - uses: actions/cache/save@v3
    if: always() // or any other condition to invoke the save action
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

## Restore followed by save

<!--
Basic restore save example
- Using default cache action
- Using restore and save actions together with possibilities.
Restore save example with advanced controls
- Using if conditions to achieve use cases that we solved 
- Fail workflow on cache miss
- Force rewrite cache by deleting cache between steps using cli
-->
### Using Cache action

The [cache](https://github.com/actions/cache/tree/main#cache) action allows caching dependencies and build outputs to improve workflow execution time.

It has a `main` step and a `post` step. In the `main` step, the cache is restored if it exists for the input `key`, `path` combination (refer [scope](#scope)). If cache is not found for the given `key` input, then cache is restored using [restore keys](#restore-keys) . If the cache doesn't exist or is restored using `restore-keys`, the cache is saved in the `post` step of this action.

**Usage**

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

The `cache` action provides one output `cache-hit` which is set to `true` when cache is restored using primary key and `false` when cache is restored using `restore-keys` or no cache is restored.

### Using combination of restore and save actions



## Save followed by restore

### Save intermediate private build artifacts

In case of multi-module projects, where the built artifact of one project needs to be reused in subsequent child modules, the need of rebuilding the parent module again and again with every build can be eliminated. The `actions/cache` or `actions/cache/save` action can be used to build and save the parent module artifact once, and restored multiple times while building the child modules.


#### Step 1 - Build the parent module and save it
```yaml
steps:
  - uses: actions/checkout@v3

  - name: Build
    run: /build-parent-module.sh

  - uses: actions/cache/save@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

#### Step 2 - Restore the built artifact from cache using the same key and path
```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache/restore@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh

  - name: Build
    run: /build-child-module.sh

  - name: Publish package to public
    run: /publish.sh
```

## Snippets

<!-- Similar to available in README but updating set-output method and adding new package managers. -->
