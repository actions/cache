# Check action

The check action checks if a cache entry exists without actually downloading it.

## Inputs

* `path` - A list of files, directories, and wildcard patterns to cache and restore. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `key` - String used while saving cache for restoring the cache
* `restore-keys` - An ordered list of prefix-matched keys to use for restoring stale cache if no cache hit occurred for key.
* `fail-on-cache-miss` - Fail the workflow if cache entry is not found. Default: `false`

## Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key. 
* `cache-primary-key` - Cache primary key passed in the input to use in subsequent steps of the workflow.
* `cache-matched-key` -  Key of the cache that was restored, it could either be the primary key on cache-hit or a partial/complete match of one of the restore keys.

> **Note**
`cache-hit` will be set to `true` only when cache hit occurs for the exact `key` match. For a partial key match via `restore-keys` or a cache miss, it will be set to `false`.

## Use cases

As this is a newly introduced action to give users more control in their workflows, below are some use cases where one can use this action.

### Skip downloading cache if entry exists

Sometimes it's useful to separate build and test jobs. In that case it's not necessary
to restore the cache in the first job if an entry already exists.

#### Step 1 - Build artifact only if cache doesn't exist 

```yaml
build:
  steps:
    - uses: actions/checkout@v3
    
    - users: actions/cache/check@v3
      id: cache-check
      with:
        path: path/to/dependencies
        key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
    
    - name: Build
      if: steps.cache-check.outputs.cache-hit != 'true'
      run: /build.sh
      
    - uses: actions/cache/save@v3
      if: steps.cache-check.outputs.cache-hit != 'true'
      with:
        path: path/to/dependencies
        key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

#### Step 2 - Restore the built artifact from cache using the same key and path

```yaml
test:
  needs: build
  matrix:
    key: [1, 2, 3]
  steps:
    - uses: actions/checkout@v3

    - uses: actions/cache/restore@v3
      with:
        path: path/to/dependencies
        fail-on-cache-miss: true
        key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

    - name: Test
      run: /test.sh -key ${{ matrix.key }}
```
