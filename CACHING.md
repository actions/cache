# Cache Recipes

This document focuses on gathering all the common use cases that will help the users of `actions/cache`
- Know the use cases that can be tackled and sample workflows on how to tackle them
- Optimise their workflows to use the cache inputs and outputs better

## Actions Cache Basics

The cache action works using the following set of inputs and outputs as mentioned [here](https://github.com/actions/cache#inputs). However these inputs are self explaining below are some ways in which the inputs can be used in a better way.

### Keys

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

Cache key by Operating system: 
```yaml
    key: ${{ runner.os }}-cache
```
Cache key by Workflow run id/attempt: 
```yaml
    key: cache-${{ github.run_id }}-${{ github.run_attempt }}
```
Cache key by commit id: 
```yaml
    key: cache-${{ github.sha }}
```
Cache key by lockfile: 
```yaml
    key: cache-${{ hashFiles('**/lockfiles') }}
```
Cache key by combination of multiple options: 
```yaml
    key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

The [GitHub Context](https://docs.github.com/en/actions/learn-github-actions/contexts#github-context) can be used to create keys using the workflows metadata.

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

## Cache action

### Sample workflow for cache action

## Restore action

### Sample workflow for restore action

## Save action

### Sample workflow for save action

## Restore followed by save

## Save followed by restore


## Optimisation

## Storage

## Snippets

