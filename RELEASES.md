# Releases

### 3.0.0
- Updated minimum runner version support from node 12 -> node 16

### 3.0.1
- Added support for caching from GHES 3.5.
- Fixed download issue for files > 2GB during restore.

### 3.0.2
- Added support for dynamic cache size cap on GHES.

### 3.0.3
- Fixed avoiding empty cache save when no files are available for caching. ([issue](https://github.com/actions/cache/issues/624))

### 3.0.4
- Fixed tar creation error while trying to create tar with path as `~/` home folder on `ubuntu-latest`. ([issue](https://github.com/actions/cache/issues/689))

### 3.0.5
- Removed error handling by consuming actions/cache 3.0 toolkit, Now cache server error handling will be done by toolkit. ([PR](https://github.com/actions/cache/pull/834))