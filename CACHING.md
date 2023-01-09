# Cache Recipes

This document lists some of the strategies (and example workflows if possible) which can be used

- to solve some common use cases
- to effectively leverage the step inputs and outputs

## Strategically using keys

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    - uses: actions/cache@v3
      with:
        key: ${{ some-metadata }}-cache
```

In your workflows, you can use different strategies to name your key depending on your use case so that the cache is scoped properly based on the need. If you wish to create OS specific caches, or caches based on the lockfiles, commit SHA, workflow run id, etc. then you can generate the keys dynamically at run-time. Below are some of the tips to strategically name your cache using the [cache](https://github.com/actions/cache) or [restore](https://github.com/actions/cache/tree/main/restore) action.

### Updating cache for any change in the dependencies

One of the most common use case is to use hash for lockfile as key. This way same cache will be restored for same lockfiles until there's any change in the lockfile/dependencies.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: cache-${{ hashFiles('**/lockfiles') }}
```

### Using restore keys to download the closest matching cache

If cache is not found matching the primary key, restore keys will be used to download the closest matching cache that was recently created. This way most of the dependencies can be downloaded from the restore key hence saving some build time.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: cache-npm-${{ hashFiles('**/lockfiles') }}
      restore-keys: |
        cache-npm-
```

The restore keys can be provided as a complete name, or a prefix, read more [here](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) on how a cache key is matched using restore keys.

### Separate caches by Operating System

In case of workflows with matrix running for multiple Operating Systems, the caches can be stored separately for each of them. This can be used in combination with hashfiles in case multiple caches are being generated per OS.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-cache
```

### Limiting cache to only the current workflow/attempt

Caches scoped to the particular workflow run id or run attempt can be stored and referred by using the run id/attempt

```yaml
    key: cache-${{ github.run_id }}-${{ github.run_attempt }}
```

### Limiting cache for a particular commit

For very short term or isolated use cases, where cache is supposed to be short lived, commit sha can be used.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: cache-${{ github.sha }}
```

### Using multiple factors while forming a key depening on the need

Cache key can be formed by combination of more than one metadata, evaluated info.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

The [GitHub Context](https://docs.github.com/en/actions/learn-github-actions/contexts#github-context) can be used to create keys using the workflows metadata.

## Restoring Cache

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

### Failing/Exiting the workflow if cache with exact key is not found

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

## Saving cache

### Reusing primary key from restore cache as input to save action

If you want to avoid re-writing the cache key again in `save` action, the outputs from `restore` action can be used as input to the `restore` action.

```yaml
  - uses: actions/cache/restore@v3
    id: restore-cache
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
  .
  .
  .
  - uses: actions/cache/save@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ steps.restore-cache.outputs.key }}
```

### Re-evaluate cache key while saving cache

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

### Saving cache even if the build fails

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

## Restoring and saving caches

### Restoring and saving cache using a single action

The [cache](https://github.com/actions/cache) action allows caching dependencies and restoring them using a single action. It has a `main` step and a `post` step. In the `main` step, the cache is restored if it exists for the input `key`, `path` combination. If cache is not found for the given `key` input, then cache is restored using `restore keys`. If the cache doesn't exist or is restored using `restore-keys`, the cache is saved in the `post` step of this action.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

The `cache` action provides one output `cache-hit` which is set to `true` when cache is restored using primary key and `false` when cache is restored using `restore-keys` or no cache is restored.

### Download remaining dependencies in case of cache miss

In case cache gets download using restore keys, there's a chance that some dependencies might be missing. It might also be possible that no cache was restored because there was no match. In such cases, the output `cache-hit` is set to `false`. We can make use of this output to download the remaining dependencies.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: ./install-dependencies.sh
```

### Using combination of restore and save actions

```yaml
  - uses: actions/cache/restore@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
  - name: build
    run: ./install.sh
  - uses: actions/cache/save@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

### Saving intermediate private build artifacts and restoring in another workflow

In case of multi-module projects, where the built artifact of one project needs to be reused in subsequent child modules, the need of rebuilding the parent module again and again with every build can be eliminated. The `actions/cache` or `actions/cache/save` action can be used to build and save the parent module artifact once, and restored multiple times while building the child modules.

#### Step 1 - Build the parent module and save it

```yaml
steps:
  - uses: actions/checkout@v3

  - name: Build
    run: ./build-parent-module.sh

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
    run: ./install.sh
      
  - name: Build
    run: ./build-child-module.sh

  - name: Publish package to public
    run: ./publish.sh
```
