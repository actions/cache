# GitHub Actions Cache with Google Cloud Storage Support

This fork of the GitHub Actions cache action adds Google Cloud Storage (GCS) as a cache backend with fallback to GitHub's built-in cache. This provides several key benefits:

- **Larger caches**: Store cache files beyond GitHub's 10GB repository limit
- **Cross-repository caching**: Access the same cache across multiple repositories
- **Custom retention**: Control cache retention policies through GCS lifecycle management
- **Existing infrastructure**: Leverage your existing GCS infrastructure and permissions

## Quick Setup Guide

1. **Create a GCS bucket** for your caches (if you don't already have one)
2. **Set up authentication**:
   ```yaml
   - uses: google-github-actions/auth@v2
     with:
       credentials_json: ${{ secrets.GCP_CREDENTIALS }}
   ```
3. **Add to your workflow**:
   ```yaml
   - uses: danySam/gcs-cache@v1
     with:
       path: ~/.npm
       key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
       gcs-bucket: your-gcs-bucket-name
   ```

That's it! Your cache will now use GCS storage with automatic fallback to GitHub's cache.

## Documentation

See ["Caching dependencies to speed up workflows"](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows) for GitHub's cache documentation.

## Using GCS Cache

```yaml
# Quick start example
name: Build with GCS Cache
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: 'read'
      id-token: 'write' # Required for GCP workload identity federation
    steps:
    - uses: actions/checkout@v4
    
    # Authenticate with Google Cloud
    - uses: google-github-actions/auth@v2
      with:
        credentials_json: ${{ secrets.GCP_CREDENTIALS }}
        # Or use workload identity federation
    
    # Cache dependencies with GCS
    - uses: danySam/gcs-cache@v1
      with:
        path: path/to/dependencies
        key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
        gcs-bucket: your-gcs-bucket-name
```

#### Authentication with Google Cloud

This action uses [Application Default Credentials (ADC)](https://cloud.google.com/docs/authentication/application-default-credentials) to authenticate with Google Cloud. The recommended approach is to use the official Google Cloud auth action:

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

#### GCS Cache Configuration

After authentication is set up, configure the action with:
```yaml
- uses: danySam/gcs-cache@v1
  with:
    path: path/to/dependencies
    key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
    gcs-bucket: your-gcs-bucket-name
    gcs-path-prefix: custom/prefix  # Optional, defaults to "github-cache"
```

#### Automatic Fallback to GitHub Cache

This action is designed to gracefully handle scenarios where GCS isn't available:

- If the GCS bucket isn't specified, it uses GitHub's cache
- If GCS authentication fails, it falls back to GitHub's cache
- If storing/retrieving from GCS fails, it falls back to GitHub's cache

This ensures your workflows will continue to function even if there are issues with GCS access.

## What's New

### GCS Cache Integration

This fork adds full Google Cloud Storage integration to the GitHub Actions cache:

- **GCS Backend**: Use GCS as your primary cache backend
- **Automatic Fallback**: Gracefully falls back to GitHub's cache if GCS is unavailable
- **Simple Configuration**: Just add `gcs-bucket` parameter to switch to GCS storage
- **Cross-Repository**: Share caches between different repositories using the same GCS bucket

### Migration from actions/cache

Switching from `actions/cache` to this GCS-enabled fork is straightforward:

```diff
- uses: actions/cache@v4
+ uses: danySam/gcs-cache@v1
  with:
    path: path/to/dependencies
    key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
+   gcs-bucket: your-gcs-bucket-name      # Add this line to use GCS
+   gcs-path-prefix: custom/prefix        # Optional
```

The `v1` release of this fork is based on `actions/cache@v4` and maintains full compatibility with all existing cache functionality.

### Compatibility Notes

This fork maintains complete compatibility with:

- The standard GitHub Actions cache API
- The v4 cache service APIs
- All existing cache features (cross-OS caching, lookup-only, etc.)

See the [official repo](https://github.com/actions/cache/) for more information on the base action.

> **Note:** The GitHub cache backend service is undergoing changes as of February 1st, 2025. This fork is compatible with the new v2 cache service APIs.

## Usage

### Pre-requisites

Create a workflow `.yml` file in your repository's `.github/workflows` directory. An [example workflow](#example-cache-workflow) is available below. For more information, see the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

If you are using this inside a container, a POSIX-compliant `tar` needs to be included and accessible from the execution path.

If you are using a `self-hosted` Windows runner, `GNU tar` and `zstd` are required for [Cross-OS caching](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cross-os-cache) to work. They are also recommended to be installed in general so the performance is on par with `hosted` Windows runners.

### Inputs

* `key` - An explicit key for a cache entry. See [creating a cache key](#creating-a-cache-key).
* `path` - A list of files, directories, and wildcard patterns to cache and restore. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `restore-keys` - An ordered multiline string listing the prefix-matched keys, that are used for restoring stale cache if no cache hit occurred for key.
* `enableCrossOsArchive` - An optional boolean when enabled, allows Windows runners to save or restore caches that can be restored or saved respectively on other platforms. Default: `false`
* `fail-on-cache-miss` - Fail the workflow if cache entry is not found. Default: `false`
* `lookup-only` - If true, only checks if cache entry exists and skips download. Does not change save cache behavior. Default: `false`
* `gcs-bucket` - Google Cloud Storage bucket name to use for caching. When provided, GCS will be used as the cache backend.
* `gcs-credentials` - Google Cloud Storage credentials JSON (service account key). If not provided, default authentication will be used.
* `gcs-path-prefix` - Optional prefix path within the GCS bucket for cache files. Default: `github-cache`

#### Environment Variables

* `SEGMENT_DOWNLOAD_TIMEOUT_MINS` - Segment download timeout (in minutes, default `10`) to abort download of the segment if not completed in the defined number of minutes. [Read more](https://github.com/actions/cache/blob/main/tips-and-workarounds.md#cache-segment-restore-timeout)

### Outputs

* `cache-hit` - A string value to indicate an exact match was found for the key.
  * If there's a cache hit, this will be 'true' or 'false' to indicate if there's an exact match for `key`.
  * If there's a cache miss, this will be an empty string.

See [Skipping steps based on cache-hit](#skipping-steps-based-on-cache-hit) for info on using this output

### Cache scopes

The cache is scoped to the key, [version](#cache-version), and branch. The default branch cache is available to other branches.

See [Matching a cache key](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) for more info.

### Example cache workflow

#### Restoring and saving cache using a single action

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Cache Primes
      id: cache-primes
      uses: danySam/gcs-cache@v1
      with:
        path: prime-numbers
        key: ${{ runner.os }}-primes

    - name: Generate Prime Numbers
      if: steps.cache-primes.outputs.cache-hit != 'true'
      run: /generate-primes.sh -d prime-numbers

    - name: Use Prime Numbers
      run: /primes.sh -d prime-numbers
```

The `cache` action provides a `cache-hit` output which is set to `true` when the cache is restored using the primary `key` and `false` when the cache is restored using `restore-keys` or no cache is restored.

#### Using a combination of restore and save actions

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Restore cached Primes
      id: cache-primes-restore
      uses: danySam/gcs-cache/restore@v1
      with:
        path: |
          path/to/dependencies
          some/other/dependencies
        key: ${{ runner.os }}-primes
    .
    . //intermediate workflow steps
    .
    - name: Save Primes
      id: cache-primes-save
      uses: danySam/gcs-cache/save@v1
      with:
        path: |
          path/to/dependencies
          some/other/dependencies
        key: ${{ steps.cache-primes-restore.outputs.cache-primary-key }}
```

> **Note**
> You must use the `cache` or `restore` action in your workflow before you need to use the files that might be restored from the cache. If the provided `key` matches an existing cache, a new cache is not created and if the provided `key` doesn't match an existing cache, a new cache is automatically created provided the job completes successfully.

## Caching Strategies

With the introduction of the `restore` and `save` actions, a lot of caching use cases can now be achieved. Please see the [caching strategies](./caching-strategies.md) document for understanding how you can use the actions strategically to achieve the desired goal.

## Implementation Examples

### GCS Caching Examples

See our [GCS-specific examples](examples.md#google-cloud-storage-cache) for complete workflow templates using Google Cloud Storage caching.

## Creating a cache key

A cache key can include any of the contexts, functions, literals, and operators supported by GitHub Actions.

For example, using the [`hashFiles`](https://docs.github.com/en/actions/learn-github-actions/expressions#hashfiles) function allows you to create a new cache when dependencies change.

```yaml
  - uses: danySam/gcs-cache@v1
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

Additionally, you can use arbitrary command output in a cache key, such as a date or software version:

```yaml
  # http://man7.org/linux/man-pages/man1/date.1.html
  - name: Get Date
    id: get-date
    run: |
      echo "date=$(/bin/date -u "+%Y%m%d")" >> $GITHUB_OUTPUT
    shell: bash

  - uses: danySam/gcs-cache@v1
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ steps.get-date.outputs.date }}-${{ hashFiles('**/lockfiles') }}
```

See [Using contexts to create cache keys](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#using-contexts-to-create-cache-keys)

## Cache Limits

A repository can have up to 10GB of caches. Once the 10GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.

## Skipping steps based on cache-hit

Using the `cache-hit` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the key.  It is recommended to install missing/updated dependencies in case of a partial key match when the key is dependent on the `hash` of the package file.

Example:

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: danySam/gcs-cache@v1
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh
```

> **Note** The `id` defined in `danySam/gcs-cache` must match the `id` in the `if` statement (i.e. `steps.[ID].outputs.cache-hit`)

## Cache Version

Cache version is a hash [generated](https://github.com/actions/toolkit/blob/500d0b42fee2552ae9eeb5933091fe2fbf14e72d/packages/cache/src/internal/cacheHttpClient.ts#L73-L90) for a combination of compression tool used (Gzip, Zstd, etc. based on the runner OS) and the `path` of directories being cached. If two caches have different versions, they are identified as unique caches while matching. This, for example, means that a cache created on a `windows-latest` runner can't be restored on `ubuntu-latest` as cache `Version`s are different.

> Pro tip: The [list caches](https://docs.github.com/en/rest/actions/cache#list-github-actions-caches-for-a-repository) API can be used to get the version of a cache. This can be helpful to troubleshoot cache miss due to version.

<details>
  <summary>Example</summary>
The workflow will create 3 unique caches with same keys. Ubuntu and windows runners will use different compression technique and hence create two different caches. And `build-linux` will create two different caches as the `paths` are different.

```yaml
jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Cache Primes
        id: cache-primes
        uses: danySam/gcs-cache@v1
        with:
          path: prime-numbers
          key: primes

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d prime-numbers

      - name: Cache Numbers
        id: cache-numbers
        uses: danySam/gcs-cache@v1
        with:
          path: numbers
          key: primes

      - name: Generate Numbers
        if: steps.cache-numbers.outputs.cache-hit != 'true'
        run: ./generate-primes.sh -d numbers

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Cache Primes
        id: cache-primes
        uses: danySam/gcs-cache@v1
        with:
          path: prime-numbers
          key: primes

      - name: Generate Prime Numbers
        if: steps.cache-primes.outputs.cache-hit != 'true'
        run: ./generate-primes -d prime-numbers
```

</details>

## Known practices and workarounds

There are a number of community practices/workarounds to fulfill specific requirements. You may choose to use them if they suit your use case. Note these are not necessarily the only solution or even a recommended solution.

* [Cache segment restore timeout](./tips-and-workarounds.md#cache-segment-restore-timeout)
* [Update a cache](./tips-and-workarounds.md#update-a-cache)
* [Use cache across feature branches](./tips-and-workarounds.md#use-cache-across-feature-branches)
* [Cross OS cache](./tips-and-workarounds.md#cross-os-cache)
* [Force deletion of caches overriding default cache eviction policy](./tips-and-workarounds.md#force-deletion-of-caches-overriding-default-cache-eviction-policy)

### Windows environment variables

Please note that Windows environment variables (like `%LocalAppData%`) will NOT be expanded by this action. Instead, prefer using `~` in your paths which will expand to the HOME directory. For example, instead of `%LocalAppData%`, use `~\AppData\Local`. For a list of supported default environment variables, see the [Learn GitHub Actions: Variables](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables) page.

## Contributing

We would love for you to contribute to `danySam/gcs-cache`. Pull requests are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
