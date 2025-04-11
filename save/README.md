# Save Action with Google Cloud Storage Support

The save action saves a cache to Google Cloud Storage (GCS) with fallback to GitHub's cache backend. This action provides the granular ability to save a cache without first having to restore it, or to save a cache at any stage of the workflow job—not only in the post phase.

## Documentation

### Inputs

* `key` - An explicit key for a cache entry. See [creating a cache key](../README.md#creating-a-cache-key).
* `path` - A list of files, directories, and wildcard patterns to cache. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `upload-chunk-size` - The chunk size used to split up large files during upload, in bytes
* `gcs-bucket` - Google Cloud Storage bucket name to use for caching. When provided, GCS will be used as the cache backend.
* `gcs-path-prefix` - Optional prefix path within the GCS bucket for cache files. Default: `github-cache`

### GCS Authentication

This action uses [Application Default Credentials (ADC)](https://cloud.google.com/docs/authentication/application-default-credentials) to authenticate with Google Cloud. The recommended approach is to use the official Google Cloud auth action before using this action:

```yaml
- uses: google-github-actions/auth@v2
  with:
    # Using Service Account Key JSON (less secure)
    credentials_json: ${{ secrets.GCP_CREDENTIALS }}
    
    # Alternatively, use Workload Identity Federation (more secure)
    # workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
    # service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
```

For Workload Identity Federation, your workflow will need these permissions:
```yaml
permissions:
  contents: 'read'
  id-token: 'write' # Required for workload identity federation
```

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

  - uses: danySam/gcs-cache/save@v1
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
      gcs-bucket: my-github-cache-bucket # Optional: Use GCS for caching
```

### Re-evaluate cache key while saving

With this save action, the key can now be re-evaluated while executing the action. This helps in cases where lockfiles are generated during the build.

Let's say we have a restore step that computes a key at runtime.

#### Restore a cache

```yaml
uses: danySam/gcs-cache/restore@v1
id: restore-cache
with:
    key: cache-${{ hashFiles('**/lockfiles') }}
    gcs-bucket: my-github-cache-bucket
```

#### Case 1 - Where a user would want to reuse the key as it is
```yaml
uses: danySam/gcs-cache/save@v1
with:
    key: ${{ steps.restore-cache.outputs.cache-primary-key }}
```

#### Case 2 - Where the user would want to re-evaluate the key

```yaml
uses: danySam/gcs-cache/save@v1
with:
    key: npm-cache-${{hashfiles(package-lock.json)}}
    gcs-bucket: my-github-cache-bucket
```

### Always save cache

There are instances where some flaky test cases would fail the entire workflow and users would get frustrated because the builds would run for hours and the cache couldn't be saved as the workflow failed in between.
For such use-cases, users now have the ability to use the `danySam/gcs-cache/save` action to save the cache by using an [`always()`](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/expressions#always) condition.
This way the cache will always be saved if generated, or a warning will be generated that nothing is found on the cache path. Users can also use the `if` condition to only execute the `danySam/gcs-cache/save` action depending on the output of previous steps. This way they get more control of when to save the cache.

To avoid saving a cache that already exists, the `cache-hit` output from a restore step should be checked.

The `cache-primary-key` output from the restore step should also be used to ensure
the cache key does not change during the build if it's calculated based on file contents.

Here's an example where we imagine we're calculating a lot of prime numbers and want to cache them:

```yaml
name: Always Caching Prime Numbers

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Restore cached Prime Numbers
      id: cache-prime-numbers-restore
      uses: danySam/gcs-cache/restore@v1
      with:
        key: ${{ runner.os }}-prime-numbers
        path: |
          path/to/dependencies
          some/other/dependencies
        gcs-bucket: my-github-cache-bucket

    # Intermediate workflow steps

    - name: Always Save Prime Numbers
      id: cache-prime-numbers-save
      if: always() && steps.cache-prime-numbers-restore.outputs.cache-hit != 'true'
      uses: danySam/gcs-cache/save@v1
      with:
        key: ${{ steps.cache-prime-numbers-restore.outputs.cache-primary-key }}
        path: |
          path/to/dependencies
          some/other/dependencies
```
