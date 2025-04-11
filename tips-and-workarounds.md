# Tips and workarounds

## Google Cloud Storage configuration

When using Google Cloud Storage (GCS) as a cache backend, consider these best practices and troubleshooting tips:

### Setting up GCS for caching

1. **Create a dedicated bucket**: Create a GCS bucket specifically for GitHub Actions cache files.
   ```
   gsutil mb gs://my-github-cache-bucket
   ```

2. **Set proper lifecycle policies**: To automatically clean up old caches, set a lifecycle policy:
   ```
   gsutil lifecycle set lifecycle-policy.json gs://my-github-cache-bucket
   ```
   
   Where `lifecycle-policy.json` contains:
   ```json
   {
     "rule": [
       {
         "action": {"type": "Delete"},
         "condition": {"age": 30}
       }
     ]
   }
   ```

3. **Configure authentication**: You have several options for authentication:

   #### Option 1: Workload Identity Federation (Recommended)
   
   This is the most secure approach as it doesn't require managing service account keys:
   
   ```yaml
   - uses: google-github-actions/auth@v2
     with:
       workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
       service_account: 'my-service-account@my-project.iam.gserviceaccount.com'
   ```
   
   See [Google's documentation on setting up Workload Identity Federation](https://github.com/google-github-actions/auth#setup) for details.

   #### Option 2: Service Account Key
   
   If you need to use a service account key:
   
   ```yaml
   - uses: google-github-actions/auth@v2
     with:
       credentials_json: ${{ secrets.GCP_CREDENTIALS }}
   ```
   
   To create a service account and key:
   ```
   gcloud iam service-accounts create github-actions-cache
   gsutil iam ch serviceAccount:github-actions-cache@PROJECT_ID.iam.gserviceaccount.com:objectAdmin gs://my-github-cache-bucket
   gcloud iam service-accounts keys create key.json --iam-account=github-actions-cache@PROJECT_ID.iam.gserviceaccount.com
   ```
   
   Then add the contents of the key.json file as a GitHub repository secret (e.g., `GCP_CREDENTIALS`).

### Advanced GCS Cache Configuration

#### Cross-Repository Caching

One of the key advantages of using GCS for caching is the ability to share caches across multiple repositories. To implement cross-repository caching:

1. Use the same GCS bucket across all repositories
2. Create a consistent key naming scheme across repositories
3. Grant appropriate permissions to all repository service accounts

Example key scheme for cross-repository sharing:
```yaml
key: shared-deps-${{ hashFiles('**/package-lock.json') }}
```

#### Cache Persistence Control

Unlike GitHub's cache that automatically evicts entries based on usage, GCS allows fine-grained control over cache persistence through lifecycle policies:

- **Short-lived caches**: For rapid iteration environments (like CI)
  ```json
  {
    "rule": [{ "action": {"type": "Delete"}, "condition": {"age": 7} }]
  }
  ```

- **Long-lived caches**: For stable dependency caching
  ```json
  {
    "rule": [{ "action": {"type": "Delete"}, "condition": {"age": 90} }]
  }
  ```

- **Storage class transitions**: For cost optimization
  ```json
  {
    "rule": [
      { 
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"}, 
        "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]} 
      }
    ]
  }
  ```

#### Dealing with Large Caches

GCS handles large caches much more efficiently than GitHub's cache service:

- No 10GB repository limit
- Better support for large file uploads and downloads
- Consider using compression tools like `zstd` for extremely large caches

## Cache segment restore timeout

### GitHub Cache Behavior
When using the GitHub cache backend, cache files are downloaded in multiple segments of fixed sizes (`1GB` for a `32-bit` runner and `2GB` for a `64-bit` runner). Sometimes, a segment download gets stuck which causes the workflow job to be stuck forever and fail. The segment download timeout allows the segment download to get aborted and hence allow the job to proceed with a cache miss.

Default value of this timeout is 10 minutes and can be customized by specifying an [environment variable](https://docs.github.com/en/actions/learn-github-actions/environment-variables) named `SEGMENT_DOWNLOAD_TIMEOUT_MINS` with timeout value in minutes.

### GCS Cache Behavior
When using the GCS cache backend, downloads happen directly from GCS and are not segmented. This provides better performance and reliability for large caches. The GCS downloads are subject to the standard Google Cloud Storage download timeouts.

## Update a cache

A cache today is immutable and cannot be updated. But some use cases require the cache to be saved even though there was a "hit" during restore. To do so, use a `key` which is unique for every run and use `restore-keys` to restore the nearest cache. For example:

  ```yaml
      - name: update cache on every commit
        uses: danySam/gcs-cache@v1
        with:
          path: prime-numbers
          key: primes-${{ runner.os }}-${{ github.run_id }} # Can use time based key as well
          restore-keys: |
            primes-${{ runner.os }}
          gcs-bucket: my-github-cache-bucket # Optional: Use GCS for caching
  ```

  Please note that this will create a new cache on every run. 
  
  - When using GitHub's cache, this will count towards your [GitHub cache quota](./README.md#cache-limits) (10GB per repository).
  - When using GCS, this will count towards your [Google Cloud Storage quota](https://cloud.google.com/storage/quotas), which is generally much higher and can be increased.
  
## Use cache across feature branches

### GitHub Cache Limitations

Reusing GitHub's cache across feature branches is not allowed to provide cache [isolation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache). However if both feature branches are from the default branch, a good way to achieve this is to ensure that the default branch has a cache. This cache will then be consumable by both feature branches.

### GCS Cross-Branch Sharing

When using GCS as the cache backend, you can freely share caches across branches by using the same key pattern. This is one of the significant advantages of using GCS for caching. To implement this:

```yaml
- uses: danySam/gcs-cache@v1
  with:
    path: path/to/dependencies
    key: cross-branch-cache-${{ hashFiles('**/lockfiles') }}
    gcs-bucket: my-github-cache-bucket
```

By omitting any branch information from the cache key, the same cache can be accessed regardless of which branch is being built.

## Cross OS cache

From `v3.2.3` cache is cross-os compatible when `enableCrossOsArchive` input is passed as true. This means that a cache created on `ubuntu-latest` or `mac-latest` can be used by `windows-latest` and vice versa, provided the workflow which runs on `windows-latest` have input `enableCrossOsArchive` as true. This is useful to cache dependencies which are independent of the runner platform. This will help reduce the consumption of the cache quota and help build for multiple platforms from the same cache. Things to keep in mind while using this feature:

- Only cache files that are compatible across OSs.
- Caching symlinks might cause issues while restoring them as they behave differently on different OSs.
- Be mindful when caching files from outside your github workspace directory as the directory is located at different places across OS.
- Avoid using directory pointers such as `${{ github.workspace }}` or `~` (home) which eventually evaluate to an absolute path that does not match across OSs.

## Force deletion of caches

### GitHub Cache Cleanup

GitHub caches have [branch scope restriction](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache) in place. This means that if caches for a specific branch are using a lot of storage quota, it may result into more frequently used caches from `default` branch getting thrashed. For example, if there are many pull requests happening on a repo and are creating caches, these cannot be used in default branch scope but will still occupy a lot of space till they get cleaned up by [eviction policy](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy). But sometime we want to clean them up on a faster cadence so as to ensure default branch is not thrashing.

### GCS Cache Cleanup

For GCS caches, you have several options for managing and cleaning up caches:

1. **Lifecycle Policies**: As mentioned earlier, setting up lifecycle policies is the most automated way to manage cache expiration:
   ```
   gsutil lifecycle set lifecycle-policy.json gs://my-github-cache-bucket
   ```

2. **Manual Deletion**: You can manually delete specific cache files or patterns:
   ```yaml
   - name: Clean up old caches
     uses: google-github-actions/auth@v2
     with:
       credentials_json: ${{ secrets.GCP_CREDENTIALS }}
   
   - name: Delete old caches
     run: |
       gsutil -m rm gs://my-github-cache-bucket/github-cache/old-pattern-*
   ```

3. **Scheduled Cleanup**: You can create a scheduled workflow to periodically clean up caches:
   ```yaml
   name: Cleanup GCS Caches
   on:
     schedule:
       - cron: '0 0 * * 0'  # Weekly on Sunday
   
   jobs:
     cleanup:
       runs-on: ubuntu-latest
       steps:
         - uses: google-github-actions/auth@v2
           with:
             credentials_json: ${{ secrets.GCP_CREDENTIALS }}
         
         - name: Delete old caches
           run: |
             # Delete caches older than 30 days
             gsutil -m rm $(gsutil ls -l gs://my-github-cache-bucket | grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}' | awk '{if (system("date -d \"" $2 " 30 days ago\" +%s > /dev/null 2>&1") == 0) {print $3}}')
   ```

<details>
  <summary>Example</summary>

```yaml
name: cleanup caches by a branch
on:
  pull_request:
    types:
      - closed
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      # `actions:write` permission is required to delete caches
      #   See also: https://docs.github.com/en/rest/actions/cache?apiVersion=2022-11-28#delete-a-github-actions-cache-for-a-repository-using-a-cache-id
      actions: write
      contents: read
    steps:
      - name: Cleanup
        run: |
          echo "Fetching list of cache key"
          cacheKeysForPR=$(gh cache list --ref $BRANCH --limit 100 --json id --jq '.[].id')

          ## Setting this to not fail the workflow while deleting cache keys.
          set +e
          echo "Deleting caches..."
          for cacheKey in $cacheKeysForPR
          do
              gh cache delete $cacheKey
          done
          echo "Done"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
          BRANCH: refs/pull/${{ github.event.pull_request.number }}/merge
```

</details>
