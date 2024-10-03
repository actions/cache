# Save action

The save action saves a cache. It works similarly to the `cache` action except that it doesn't first do a restore. This action provides granular ability to save a cache without having to restore it, or to do a save at any stage of the workflow job -- not only in post phase.

## Documentation

### Inputs

* `key` - An explicit key for a cache entry. See [creating a cache key](../README.md#creating-a-cache-key).
* `path` - A list of files, directories, and wildcard patterns to cache. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `upload-chunk-size` - The chunk size used to split up large files during upload, in bytes

### Outputs

This action has no outputs.

## Use cases


### Only save cache

If you are using separate jobs for generating common artifacts and sharing them across jobs, this action will take care of your cache saving needs.

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Install Dependencies
    run: /install.sh

  - name: Build artifacts
    run: /build.sh

  - uses: actions/cache/save@v4
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

### Re-evaluate cache key while saving

With this save action, the key can now be re-evaluated while executing the action. This helps in cases where lockfiles are generated during the build.

Let's say we have a restore step that computes a key at runtime.

#### Restore a cache

```yaml
uses: actions/cache/restore@v4
id: restore-cache
with:
    key: cache-${{ hashFiles('**/lockfiles') }}
```

#### Case 1 - Where a user would want to reuse the key as it is
```yaml
uses: actions/cache/save@v4
with:
    key: ${{ steps.restore-cache.outputs.cache-primary-key }}
```

#### Case 2 - Where the user would want to re-evaluate the key

```yaml
uses: actions/cache/save@v4
with:
    key: npm-cache-${{hashfiles(package-lock.json)}}
```

### Always save cache

There are instances where some flaky test cases would fail the entire workflow and users would get frustrated because the builds would run for hours and the cache couldn't be saved as the workflow failed in between.
For such use-cases, users now have the ability to use the `actions/cache/save` action to save the cache by using an [`always()`](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/expressions#always) condition.
This way the cache will always be saved if generated, or a warning will be generated that nothing is found on the cache path. Users can also use the `if` condition to only execute the `actions/cache/save` action depending on the output of previous steps. This way they get more control of when to save the cache.

To avoid saving a cache that already exists, the `cache-hit` output from a restore step should be checked.

The `cache-primary-key` output from the restore step should also be used to ensure
the cache key does not change during the build if it's calculated based on file contents.

```yaml
name: Always Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Restore cached Primes
      id: cache-primes-restore
      uses: actions/cache/restore@v4
      with:
        key: ${{ runner.os }}-primes
        path: |
          path/to/dependencies
          some/other/dependencies

    # Intermediate workflow steps

    - name: Always Save Primes
      id: cache-primes-save
      if: always() && steps.cache-primes-restore.outputs.cache-hit != 'true'
      uses: actions/cache/save@v4
      with:
        key: ${{ steps.cache-primes-restore.outputs.cache-primary-key }}
        path: |
          path/to/dependencies
          some/other/dependencies
```
