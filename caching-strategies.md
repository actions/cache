# Caching Strategies

This document lists some of the strategies (and example workflows if possible) which can be used to ...

- use an effective cache key and/or path
- solve some common use cases around saving and restoring caches
- leverage the step inputs and outputs more effectively

## Choosing the right key

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    - uses: actions/cache@v3
      with:
        key: ${{ some-metadata }}-cache
```

In your workflows, you can use different strategies to name your key depending on your use case so that the cache is scoped appropriately for your need. For example, you can have cache specific to OS, or based on the lockfile or commit SHA or even workflow run.

### Updating cache for any change in the dependencies

One of the most common use case is to use hash for lockfile as key. This way, same cache will be restored for a lockfile until there's a change in dependencies listed in lockfile.

```yaml
  - uses: actions/cache@v3
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: cache-${{ hashFiles('**/lockfiles') }}
```

### Using restore keys to download the closest matching cache

If cache is not found matching the primary key, restore keys can be used to download the closest matching cache that was recently created. This ensures that the build/install step will need to additionally fetch just a handful of newer dependencies, and hence saving build time.

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

### Creating a short lived cache

Caches scoped to the particular workflow run id or run attempt can be stored and referred by using the run id/attempt. This is an effective way to have a short lived cache.

```yaml
    key: cache-${{ github.run_id }}-${{ github.run_attempt }}
```

On similar lines, commit sha can be used to create a very specialized and short lived cache.

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

### Understanding how to choose path

While setting paths for caching dependencies it is important to give correct path depending on the hosted runner you are using or whether the action is running in a container job. Assigning different `path` for save and restore will result in cache miss.

Below are GiHub hosted runner specific paths one should take care of when writing a workflow which saves/restores caches across OS.

#### Ubuntu Paths

Home directory (`~/`) = `/home/runner`

`${{ github.workspace }}` = `/home/runner/work/repo/repo`

`process.env['RUNNER_TEMP']`=`/home/runner/work/_temp`

`process.cwd()` = `/home/runner/work/repo/repo`

#### Windows Paths

Home directory (`~/`) = `C:\Users\runneradmin`

`${{ github.workspace }}` = `D:\a\repo\repo`

`process.env['RUNNER_TEMP']` = `D:\a\_temp`

`process.cwd()` = `D:\a\repo\repo`

#### macOS Paths

Home directory (`~/`) = `/Users/runner`

`${{ github.workspace }}` = `/Users/runner/work/repo/repo`

`process.env['RUNNER_TEMP']` = `/Users/runner/work/_temp`

`process.cwd()` = `/Users/runner/work/repo/repo`

Where:

`cwd()` = Current working directory where the repository code resides.

`RUNNER_TEMP` = Environment variable defined for temporary storage location.

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

If you want to avoid re-computing the cache key again in `save` action, the outputs from `restore` action can be used as input to the `save` action.

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
      key: ${{ steps.restore-cache.outputs.cache-primary-key }}
```

### Re-evaluate cache key while saving cache

On the other hand, the key can also be explicitly re-computed while executing the save action. This helps in cases where the lockfiles are generated during the build.

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
    key: ${{ steps.restore-cache.outputs.cache-primary-key }}
```

Case 2: Where the user would want to re-evaluate the key

```yaml
uses: actions/cache/save@v3
with:
    key: npm-cache-${{hashfiles(package-lock.json)}}
```

### Saving cache even if the build fails

There can be cases where a cache should be saved even if the build job fails. For example, a job can fail due to flaky tests but the caches can still be re-used. You can use `actions/cache/save` action to save the cache by using `if: always()` condition.

Similarly, `actions/cache/save` action can be conditionally used based on the output of the previous steps. This way you get more control on when to save the cache.

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

### Saving cache once and reusing in multiple workflows

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
