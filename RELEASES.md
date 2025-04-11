# Releases

## v1.0.0 (2025-04-11)

### Added
- Google Cloud Storage (GCS) support as a cache backend with automatic fallback to GitHub's built-in cache
- `gcs-bucket` parameter to specify the GCS bucket for caching
- `gcs-path-prefix` parameter to specify a custom prefix within the GCS bucket (defaults to "github-cache")
- Comprehensive documentation for GCS integration in README and examples
- New examples demonstrating GCS usage in different scenarios
- Added GCS-specific sections to tips-and-workarounds.md

### Benefits
- Store caches beyond GitHub's 10GB repository limit
- Share caches across multiple repositories
- Custom retention policies through GCS lifecycle management
- Cross-branch cache sharing capabilities

### Compatibility
- Maintains full compatibility with the original GitHub cache action API
- Based on actions/cache@v4 with all existing features preserved
- Compatible with both service account keys and Workload Identity Federation

