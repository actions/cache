## Cache segment restore timeout
A cache gets downloaded in multiple segments of fixed sizes (`1GB` for a `32-bit` runner and `2GB` for a `64-bit` runner). Sometimes, a segment download gets stuck which causes the workflow job to be stuck forever and fail. Version `v3.0.8` of `actions/cache` introduces a segment download timeout. The segment download timeout will allow the segment download to get aborted and hence allow the job to proceed with a cache miss.

Default value of this timeout is 60 minutes and can be customized by specifying an [environment variable](https://docs.github.com/en/actions/learn-github-actions/environment-variables) named `SEGMENT_DOWNLOAD_TIMEOUT_MINS` with timeout value in minutes.

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

## Improving cache restore performance on Windows/Using cross-os caching
Currently, cache restore is slow on Windows due to tar being inherently slow and the compression algorithm `gzip` in use. `zstd` is the default algorithm in use on linux and macos. It was disabled on Windows due to issues with bsd tar(libarchive), the tar implementation in use on Windows. 

To improve cache restore performance, we can re-enable `zstd` as the compression algorithm using the following workaround. Add the following step to your workflow before the cache step:

```yaml
    - if: ${{ runner.os == 'Windows' }}
      name: Use GNU tar
      shell: cmd
      run: |
        echo "Adding GNU tar to PATH"
        echo C:\Program Files\Git\usr\bin>>"%GITHUB_PATH%"
```

The `cache` action will use GNU tar instead of bsd tar on Windows. This should work on all Github Hosted runners as it is. For self-hosted runners, please ensure you have GNU tar and `zstd` installed.

The above workaround is also needed if you wish to use cross-os caching since difference of compression algorithms will result in different cache versions for the same cache key. So the above workaround will ensure `zstd` is used for caching on all platforms thus resulting in the same cache version for the same cache key.

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
    steps:
      - name: Check out code
        uses: actions/checkout@v3

      - name: Cleanup
        run: |
          gh extension install actions/gh-actions-cache
          
          REPO=${{ github.repository }}
          BRANCH=${{ github.ref }}

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