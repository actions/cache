# cache

This GitHub Action allows caching dependencies and build outputs to improve workflow execution time.

<a href="https://github.com/actions/cache"><img alt="GitHub Actions status" src="https://github.com/actions/cache/workflows/Tests/badge.svg?branch=master&event=push"></a>

## Documentation

See ["Caching dependencies to speed up workflows"](https://help.github.com/github/automating-your-workflow-with-github-actions/caching-dependencies-to-speed-up-workflows).

## Usage

### Pre-requisites
Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Inputs

* `path` - A directory to store and save the cache
* `key` - An explicit key for restoring and saving the cache
* `restore-keys` - An ordered list of keys to use for restoring the cache if no cache hit occurred for key

### Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key

> See [Skipping steps based on cache-hit](#Skipping-steps-based-on-cache-hit) for info on using this output

### Example workflow

```yaml
name: Example Caching with npm

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v1

    - name: Cache node modules
      uses: actions/cache@v1
      with:
        path: node_modules
        key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-node-

    - name: Install Dependencies
      run: npm install
    
    - name: Build
      run: npm run build

    - name: Test
      run: npm run test
```

## Ecosystem Examples

See [Examples](examples.md)

## Cache Limits

Individual caches are limited to 200MB and a repository can have up to 2GB of caches. Once the 2GB limit is reached, older caches will be evicted based on when the cache was last accessed.  Caches that are not accessed within the last week will also be evicted.

## Skipping steps based on cache-hit

Using the `cache-hit` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the key.

Example:
```yaml
steps:
  - uses: actions/checkout@v1

  - uses: actions/cache@v1
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles')}}
  
  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh
```

> Note: The `id` defined in `actions/cache` must match the `id` in the `if` statement (i.e. `steps.[ID].outputs.cache-hit`)

## Contributing
We would love for you to contribute to `@actions/cache`, pull requests are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License
The scripts and documentation in this project are released under the [MIT License](LICENSE)
