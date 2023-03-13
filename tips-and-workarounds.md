# Tips and workarounds

## Cache segment restore timeout

A cache gets downloaded in multiple segments of fixed sizes (`1GB` for a `32-bit` runner and `2GB` for a `64-bit` runner). Sometimes, a segment download gets stuck which causes the workflow job to be stuck forever and fail. Version `v3.0.8` of `actions/cache` introduces a segment download timeout. The segment download timeout will allow the segment download to get aborted and hence allow the job to proceed with a cache miss.

Default value of this timeout is 10 minutes and can be customized by specifying an [environment variable](https://docs.github.com/en/actions/learn-github-actions/environment-variables) named `SEGMENT_DOWNLOAD_TIMEOUT_MINS` with timeout value in minutes.

## Update a cache

A cache today is immutable and cannot be updated. But some use cases require the cache to be saved even though there was a "hit" during restore. To do so, use a `key` which is unique for every run and use `restore-keys` to restore the nearest cache. For example:

  ```yaml
      - name: update cache on every commit
        uses: actions/cache@v3
        with:
          path: prime-numbers
          key: primes-${{ runner.os }}-${{ github.run_id }} # Can use time based key as well
          restore-keys: |
            primes-${{ runner.os }}
  ```

  Please note that this will create a new cache on every run and hence will consume the cache [quota](./README.md#cache-limits).
  
## Use cache across feature branches

Reusing cache across feature branches is not allowed today to provide cache [isolation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache). However if both feature branches are from the default branch, a good way to achieve this is to ensure that the default branch has a cache. This cache will then be consumable by both feature branches.

## Cross OS cache

From `v3.2.3` cache is cross-os compatible when `enableCrossOsArchive` input is passed as true. This means that a cache created on `ubuntu-latest` or `mac-latest` can be used by `windows-latest` and vice versa, provided the workflow which runs on `windows-latest` have input `enableCrossOsArchive` as true. This is useful to cache dependencies which are independent of the runner platform. This will help reduce the consumption of the cache quota and help build for multiple platforms from the same cache. Things to keep in mind while using this feature:

- Only cache those files which are compatible across OSs.
- Caching symlinks might cause issues while restoration as they work differently on different OSs.
- Only cache files from within your github workspace directory.
- Avoid using directory pointers such as `${{ github.workspace }}` or `~` (home) which eventually evaluate to an absolute path and will not match across OSs.

## Force deletion of caches overriding default cache eviction policy

Caches have [branch scope restriction](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache) in place. This means that if caches for a specific branch are using a lot of storage quota, it may result into more frequently used caches from `default` branch getting thrashed. For example, if there are many pull requests happening on a repo and are creating caches, these cannot be used in default branch scope but will still occupy a lot of space till they get cleaned up by [eviction policy](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#usage-limits-and-eviction-policy). But sometime we want to clean them up on a faster cadence so as to ensure default branch is not thrashing. In order to achieve this, [gh-actions-cache cli](https://github.com/actions/gh-actions-cache/) can be used to delete caches for specific branches.

This workflow uses `gh-actions-cache` to delete all the caches created by a branch.
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
      - name: Check out code
        uses: actions/checkout@v3

      - name: Cleanup
        run: |
          gh extension install actions/gh-actions-cache
          
          REPO=${{ github.repository }}
          BRANCH=refs/pull/${{ github.event.pull_request.number }}/merge

          echo "Fetching list of cache key"
          cacheKeysForPR=$(gh actions-cache list -R $REPO -B $BRANCH | cut -f 1 )

          ## Setting this to not fail the workflow while deleting cache keys. 
          set +e
          echo "Deleting caches..."
          for cacheKey in $cacheKeysForPR
          do
              gh actions-cache delete $cacheKey -R $REPO -B $BRANCH --confirm
          done
          echo "Done"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

</details>
