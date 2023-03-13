# Restore action

The restore action restores a cache. It works similarly to the `cache` action except that it doesn't have a post step to save the cache. This action provides granular ability to restore a cache without having to save it. It accepts the same set of inputs as the `cache` action.

## Documentation

### Inputs

* `key` - An explicit key for a cache entry. See [creating a cache key](../README.md#creating-a-cache-key).
* `path` - A list of files, directories, and wildcard patterns to restore. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `restore-keys` - An ordered list of prefix-matched keys to use for restoring stale cache if no cache hit occurred for key.
* `fail-on-cache-miss` - Fail the workflow if cache entry is not found. Default: `false`
* `lookup-only` - If true, only checks if cache entry exists and skips download. Default: `false`

### Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key.
* `cache-primary-key` - Cache primary key passed in the input to use in subsequent steps of the workflow.
* `cache-matched-key` - Key of the cache that was restored, it could either be the primary key on cache-hit or a partial/complete match of one of the restore keys.

> **Note**
`cache-hit` will be set to `true` only when cache hit occurs for the exact `key` match. For a partial key match via `restore-keys` or a cache miss, it will be set to `false`.

### Environment Variables

* `SEGMENT_DOWNLOAD_TIMEOUT_MINS` - Segment download timeout (in minutes, default `10`) to abort download of the segment if not completed in the defined number of minutes. [Read more](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cache-segment-restore-timeout)

## Use cases

As this is a newly introduced action to give users more control in their workflows, below are some use cases where one can use this action.

### Only restore cache

If you are using separate jobs to create and save your cache(s) to be reused by other jobs in a repository, this action will take care of your cache restoring needs.

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

Once the cache is restored, unlike `actions/cache`, this action won't run a post step to do post-processing, and the rest of the workflow will run as usual.

### Save intermediate private build artifacts

In case of multi-module projects, where the built artifact of one project needs to be reused in subsequent child modules, the need to rebuild the parent module again and again with every build can be eliminated. The `actions/cache` or `actions/cache/save` action can be used to build and save the parent module artifact once, and it can be restored multiple times while building the child modules.

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

### Exit workflow on cache miss

You can use `fail-on-cache-miss: true` to exit a workflow on a cache miss. This way you can restrict your workflow to only build when there is a `cache-hit`.

To fail if there is no cache hit for the primary key, leave `restore-keys` empty!

```yaml
steps:
  - uses: actions/checkout@v3

  - uses: actions/cache/restore@v3
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
      fail-on-cache-miss: true

  - name: Build
    run: /build.sh
```

## Tips

### Reusing primary key and restored key in the save action

Usually you may want to use the same `key` with both `actions/cache/restore` and `actions/cache/save` actions. To achieve this, use `outputs` from the `restore` action to reuse the same primary key (or the key of the cache that was restored).

### Using restore action outputs to make save action behave just like the cache action

The outputs `cache-primary-key` and `cache-matched-key` can be used to check if the restored cache is same as the given primary key. Alternatively, the `cache-hit` output can also be used to check if the restored was a complete match or a partially restored cache.

### Ensuring proper restores and save happen across the actions

It is very important to use the same `key` and `path` that were used by either `actions/cache` or `actions/cache/save` while saving the cache. Learn more about cache key [naming](https://github.com/actions/cache#creating-a-cache-key) and [versioning](https://github.com/actions/cache#cache-version) here.
