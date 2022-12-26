# Save action

The save action, as the name suggest, saves a cache. It acts similar to the `cache` action except that it doesn't necessarily first do a restore. This action can provide you a granular control to only save a cache without having to necessarily restore it, or to do a restore anywhere in the workflow job and not only in post phase.

## Inputs

* `key` - 'An explicit key for saving the cache'
* `path` - 'A list of files, directories, and wildcard patterns to cache'
* `upload-chunk-size` - 'The chunk size used to split up large files during upload, in bytes'

## Outputs

This action has no outputs.

## Use cases


### Only save cache

In case you are using separate jobs for generating common artifacts and sharing them across different jobs, this action will help you with your save only needs.

```yaml
steps:
  - uses: actions/checkout@v3

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh

  - name: Build common artifacts
    run: /build.sh

  - uses: actions/cache/save@v3
    id: cache
    with:
      path: path/to/dependencies
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
