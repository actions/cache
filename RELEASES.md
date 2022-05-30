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