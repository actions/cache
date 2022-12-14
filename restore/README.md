# Restore action

The restore action, as the name suggest, restores a cache. It acts similar to the`cache` action except that it doesn't have a post step to save the cache. This action can provide you a granular control to only restore a cache without having to necessarily save it.  It accepts the same set of inputs as the `cache` action.

## Inputs

* `path` - A list of files, directories, and wildcard patterns to cache and restore. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `key` - String used while saving cache for restoring the cache
* `restore-keys` - An ordered list of prefix-matched keys to use for restoring stale cache if no cache hit occurred for key.
> **Note**
It is very important to use the same `key` and `path` that were used by either `actions/cache` or `actions/cache/save` while saving the cache.

### Environment Variables
* `SEGMENT_DOWNLOAD_TIMEOUT_MINS` - Segment download timeout (in minutes, default `60`) to abort download of the segment if not completed in the defined number of minutes. [Read more](https://github.com/actions/cache/blob/main/workarounds.md#cache-segment-restore-timeout)

## Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key. 
* `cache-primary-key` - Cache primary key passed in the input to use in subsequent steps of the workflow.
* `cache-matched-key` -  Key of the cache that was restored, it could either be the primary key on cache-hit or a partial/complete match of one of the restore keys.

> **Note**
`cache-hit` will be set to `true` only when cache hit occurs for the exact `key` match. For a partial key match via `restore-keys` or a cache miss, it will be set to `false`.

## Use cases

As this is a newly introduced action to give users more control in their workflows, below are some use cases where one can use this action.

### Only restore cache

In case you are using another workflow to create and save your cache that can be reused by other jobs in your repository, this action will take care of your restore only needs.

```
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

Once the cache is restored, this action won't run any post step to do post-processing like `actions/cache` and the rest of the workflow will run as usual.

### Save intermediate private build artifacts

In case of multi-module projects, where the built artifact of one project needs to be reused in subsequent child modules, the need of rebuilding the parent module again and again with every build can be eliminated. The `actions/cache` or `actions/cache/save` action can be used to build and save the parent module artifact once, and restored multiple times while building the child modules.


#### Step 1 - Build the parent module and save it
```
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
```
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

### Exit workflow on cache miss

You can use the output of this action to exit the workflow on cache miss. This way you can restrict your workflow to only initiate the build when `cache-hit` occurs, in other words, cache with exact key is found.

```
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

## Tips

Since this action comes with its own set of pros and cons, we are listing some of the ways by which you can tackle the limitations.

### Reusing primary key and restored key in the save action

One of the limitation you might experience is passing the same input in both `actions/cache/restore` and `actions/cache/save` action. To avoid this, you can make use of the `outputs` from the restore action to reuse the same primary key and also the key of the cache that was restored. This way changing any key in the restore action will automatically reflect in the subsequent actions where the same input is being used.

### Using restore action outputs to make save action behave just like the cache action

The outputs `cache-primary-key` and `cache-matched-key` can be used to check if the restored cache is same as the given primary key. Alternatively, the `cache-hit` output can also be used to check if the restored was a complete match or a partially restored cache.