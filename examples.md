# Examples

- [Google Cloud Storage Cache](#google-cloud-storage-cache)
  - [Basic Example](#basic-example)
  - [Separate Restore/Save Actions](#separate-restoresave-actions)
  - [Advanced GCS Cache Examples](#advanced-gcs-cache-examples)
    - [Cross-Repository Caching](#cross-repository-caching)
    - [Using Workload Identity Federation](#using-workload-identity-federation-recommended-for-production)
- [Language-Specific Caching Examples](#language-specific-caching-examples)

## Google Cloud Storage Cache

Using Google Cloud Storage (GCS) as a cache backend provides several advantages:

- **Larger storage**: Store caches beyond GitHub's 10GB repository limit
- **Cross-repository access**: Share caches between different repositories
- **Custom retention**: Control cache lifecycle with GCS retention policies  
- **Fallback mechanism**: Automatically falls back to GitHub cache if GCS is unavailable

The following examples show how to configure GCS caching in your workflows.

### Basic Example

```yaml
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

    # Set up Google Cloud authentication
    - id: auth
      uses: google-github-actions/auth@v2
      with:
        # Using Service Account Key JSON
        credentials_json: ${{ secrets.GCP_CREDENTIALS }}
        
        # Alternatively, use Workload Identity Federation (more secure)
        # workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
        # service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

    - name: Cache Dependencies
      id: cache-deps
      uses: danySam/gcs-cache@v1
      with:
        path: |
          ~/.npm
          node_modules
        key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-node-
        gcs-bucket: my-github-cache-bucket

    - name: Install Dependencies
      if: steps.cache-deps.outputs.cache-hit != 'true'
      run: npm ci

    - name: Build
      run: npm run build
```

### Separate Restore/Save Actions

For more flexible control, you can use the `restore` and `save` actions separately:

```yaml
name: Build with GCS Cache (Separate Restore/Save)

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    
    permissions:
      contents: 'read'
      id-token: 'write' # Required for GCP workload identity federation

    steps:
    - uses: actions/checkout@v4

    # Set up Google Cloud authentication
    - id: auth
      uses: google-github-actions/auth@v2
      with:
        credentials_json: ${{ secrets.GCP_CREDENTIALS }}
        # Or use workload identity federation

    - name: Restore Dependencies from Cache
      id: cache-deps-restore
      uses: danySam/gcs-cache/restore@v1
      with:
        path: |
          ~/.npm
          node_modules
        key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-node-
        gcs-bucket: my-github-cache-bucket

    - name: Install Dependencies
      if: steps.cache-deps-restore.outputs.cache-hit != 'true'
      run: npm ci

    - name: Build
      run: npm run build

    - name: Save Dependencies to Cache
      id: cache-deps-save
      uses: danySam/gcs-cache/save@v1
      with:
        path: |
          ~/.npm
          node_modules
        key: ${{ steps.cache-deps-restore.outputs.cache-primary-key }}
        gcs-bucket: my-github-cache-bucket
```

### Advanced GCS Cache Examples

#### Cross-Repository Caching

Share caches across multiple repositories using the same GCS bucket:

```yaml
name: Build with Shared GCS Cache

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    
    permissions:
      contents: 'read'
      id-token: 'write' 

    steps:
    - uses: actions/checkout@v4

    # Set up Google Cloud authentication
    - uses: google-github-actions/auth@v2
      with:
        credentials_json: ${{ secrets.GCP_CREDENTIALS }}

    - name: Shared Cross-Repo Cache
      id: shared-cache
      uses: danySam/gcs-cache@v1
      with:
        path: |
          ~/.gradle/caches
          ~/.gradle/wrapper
        key: shared-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
        restore-keys: |
          shared-gradle-
        gcs-bucket: shared-company-cache-bucket
        gcs-path-prefix: gradle-cache  # Optional: organize caches in the bucket

    # Rest of your workflow
```

#### Using Workload Identity Federation (Recommended for Production)

For production environments, Google recommends [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) over service account keys for more secure authentication. This approach eliminates the need to manage long-lived service account keys:

```yaml
name: Build with GCS Cache using Workload Identity

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    
    permissions:
      contents: 'read'
      id-token: 'write' # Required for Workload Identity Federation

    steps:
    - uses: actions/checkout@v4

    # Set up Google Cloud authentication with Workload Identity Federation
    - id: auth
      uses: google-github-actions/auth@v2
      with:
        # The workload identity provider resource name
        workload_identity_provider: projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider
        # The service account email address
        service_account: my-service-account@my-project.iam.gserviceaccount.com
        # Optional: Create credentials file for Google Cloud SDK
        create_credentials_file: true
        # Optional: Cleanup credentials after job completion
        cleanup_credentials: true

    - name: Cache Dependencies
      id: cache-deps
      uses: danySam/gcs-cache@v1
      with:
        path: path/to/dependencies
        key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
        gcs-bucket: my-github-cache-bucket
```

For detailed setup instructions, see the [Google GitHub Actions Auth documentation](https://github.com/google-github-actions/auth). The basic steps include:

1. Create a Workload Identity Pool and Provider in Google Cloud
2. Configure IAM permissions for your service account 
3. Store configuration values in GitHub Secrets
4. Add the auth action to your workflow with proper permissions

Using Workload Identity Federation provides enhanced security since:
- No long-lived credentials need to be stored as GitHub Secrets
- Access is temporary and scoped to just the running workflow
- All access is fully auditable in Google Cloud logs

## Language-Specific Caching Examples

- [Bun](#bun)
- [C# - NuGet](#c---nuget)
- [Clojure - Lein Deps](#clojure---lein-deps)
- [D - DUB](#d---dub)
  - [POSIX](#posix)
  - [Windows](#windows)
