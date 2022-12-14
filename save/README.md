# Save action

The save action saves cache just like the post step of the `cache` action, except it can be run individually now without having to call the restore step. The save action needs to be called with required inputs, the `key` with which the cache needs to be stored and the `path` that needs to be cached.

## Inputs

* `key` - 'An explicit key for saving the cache'
* `path` - 'A list of files, directories, and wildcard patterns to cache'
* `upload-chunk-size` - 'The chunk size used to split up large files during upload, in bytes'

## Outputs

This action has no outputs.

## Use cases

As this is a newly introduced action to give users more control in their workflows, below are some use cases where one can use this action.

### Only save cache

In case you are using separate jobs for generating common artifacts and sharing them across different jobs, this action will help you with your save only needs.

```
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

Some technologies like dot-net generate the lockfiles during the build time, due to which the already evaluated `${{ hashFiles('**/lockfiles') }}` hash doesn't match the actual hash. Using save action with the same key will not re-evaluate the key as hash would be calculated after the build step hence allowing the hash to be latest. 

We will also be making the restore inputted `key` available as output of `restore` action to be reused in the input of the `save` action. This way the user has to control to reuse the same key or get it re-evaluated based on their choice.

Let's say we have a restore step that computes key at runtime.

```
uses: actions/cache/restore@v3
id: restore-cache
with:
    key: cache-${{ hashFiles('**/lockfiles') }}
```

Case 1: Where an user would want to reuse the key as it is
```
uses: actions/cache/save@v3
with:
    key: steps.restore-cache.output.key
```

Case 2: Where the user would want to re-evaluate the key
```
uses: actions/cache/save@v3
with:
    key: npm-cache-${{hashfiles(package-lock.json)}}
```

### Always save cache

There are instances where some flaky test cases would fail the entire workflow and users would get frustrated because the builds would run for hours and the cache couldn't get saved as the workflow failed in between. For such use-cases, users would now have the ability to use `actions/cache/save` action to save the cache by using `if: always()` condition. This way the cache will always be saved if generated, or a warning will be thrown that nothing is found on the cache path. Users can also use the `if` condition to only execute the `actions/cache/save` action depending on the output of the previous steps. This way they get more control on when to save the cache.

Inspired from: https://github.com/actions/cache/issues/92, https://github.com/actions/cache/issues/272, https://github.com/actions/cache/issues/849

```
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
