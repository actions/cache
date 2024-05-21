# Releases

### 4.0.2

- Fixed restore `fail-on-cache-miss` not working.

### 4.0.1

- Updated `isGhes` check

### 4.0.0

- Updated minimum runner version support from node 12 -> node 20

### 3.3.3

- Updates @actions/cache to v3.2.3 to fix accidental mutated path arguments to `getCacheVersion` [actions/toolkit#1378](https://github.com/actions/toolkit/pull/1378)
- Additional audit fixes of npm package(s)

### 3.3.2

- Fixes bug with Azure SDK causing blob downloads to get stuck.

### 3.3.1

- Reduced segment size to 128MB and segment timeout to 10 minutes to fail fast in case the cache download is stuck.

### 3.3.0

- Added option to lookup cache without downloading it.

### 3.2.6

- Fix zstd not being used after zstd version upgrade to 1.5.4 on hosted runners.

### 3.2.5

- Added fix to prevent from setting MYSYS environment variable globally.

### 3.2.4

- Added option to fail job on cache miss.

### 3.2.3

- Support cross os caching on Windows as an opt-in feature.
- Fix issue with symlink restoration on Windows for cross-os caches.

### 3.2.2

- Reverted the changes made in 3.2.1 to use gnu tar and zstd by default on windows.

### 3.2.1

- Update `@actions/cache` on windows to use gnu tar and zstd by default and fallback to bsdtar and zstd if gnu tar is not available. ([issue](https://github.com/actions/cache/issues/984))
- Added support for fallback to gzip to restore old caches on windows.
- Added logs for cache version in case of a cache miss.

### 3.2.0

- Released the two new actions - [restore](restore/action.yml) and [save](save/action.yml) for granular control on cache

### 3.2.0-beta.1

- Added two new actions - [restore](restore/action.yml) and [save](save/action.yml) for granular control on cache.

### 3.1.0-beta.3

- Bug fixes for bsdtar fallback if gnutar not available and gzip fallback if cache saved using old cache action on windows.

### 3.1.0-beta.2

- Added support for fallback to gzip to restore old caches on windows.

### 3.1.0-beta.1

- Update `@actions/cache` on windows to use gnu tar and zstd by default and fallback to bsdtar and zstd if gnu tar is not available. ([issue](https://github.com/actions/cache/issues/984))

### 3.0.11

- Update toolkit version to 3.0.5 to include `@actions/core@^1.10.0`
- Update `@actions/cache` to use updated `saveState` and `setOutput` functions from `@actions/core@^1.10.0`

### 3.0.10

- Fix a bug with sorting inputs.
- Update definition for restore-keys in README.md

### 3.0.9

- Enhanced the warning message for cache unavailablity in case of GHES.

### 3.0.8

- Fix zstd not working for windows on gnu tar in issues [#888](https://github.com/actions/cache/issues/888) and [#891](https://github.com/actions/cache/issues/891).
- Allowing users to provide a custom timeout as input for aborting download of a cache segment using an environment variable `SEGMENT_DOWNLOAD_TIMEOUT_MINS`. Default is 60 minutes.

### 3.0.7

- Fixed [#810](https://github.com/actions/cache/issues/810) - download stuck issue. A new timeout is introduced in the download process to abort the download if it gets stuck and doesn't finish within an hour.

### 3.0.6

- Fixed [#809](https://github.com/actions/cache/issues/809) - zstd -d: no such file or directory error
- Fixed [#833](https://github.com/actions/cache/issues/833) - cache doesn't work with github workspace directory

### 3.0.5

- Removed error handling by consuming actions/cache 3.0 toolkit, Now cache server error handling will be done by toolkit. ([PR](https://github.com/actions/cache/pull/834))

### 3.0.4

- Fixed tar creation error while trying to create tar with path as `~/` home folder on `ubuntu-latest`. ([issue](https://github.com/actions/cache/issues/689))

### 3.0.3

- Fixed avoiding empty cache save when no files are available for caching. ([issue](https://github.com/actions/cache/issues/624))

### 3.0.2

- Added support for dynamic cache size cap on GHES.

### 3.0.1

- Added support for caching from GHES 3.5.
- Fixed download issue for files > 2GB during restore.

### 3.0.0

- Updated minimum runner version support from node 12 -> node 16
