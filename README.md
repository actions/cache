# Shockingly faster cache action

This action is a drop-in replacement for the official `actions/cache@v4` action, for use with the [RunsOn](https://runs-on.com/?ref=cache) self-hosted GitHub Action runner provider, or with your own self-hosted runner solution.

![image](https://github.com/runs-on/cache/assets/6114/e61c5b6f-aa86-48be-9e1b-baac6dce9b84)

It will automatically store your caches in a dedicated RunsOn S3 bucket that lives close to your self-hosted runners, ensuring you get at least 200MiB/s download and upload throughput when using caches in your workflows. The larger the cache, the faster the speed.

Also note that you no longer have any limit on the size of the cache. The bucket has a lifecycle rule to remove items older than 10 days.

If no S3 bucket is provided, it will also transparently switch to the default behaviour. This means you can use this action and switch between RunsOn runners and official GitHub runners with no change.

## Usage with RunsOn

If using [RunsOn](https://runs-on.com), simply replace `actions/cache@v4` with `runs-on/cache@v4`. All the official options are supported.

```diff
- - uses: actions/cache@v4
+ - uses: runs-on/cache@v4
    with:
      ...
```

Please refer to [actions/cache](https://github.com/actions/cache) for usage.

## Usage outside RunsOn

If you want to use this in your own infrastructure, setup your AWS credentials with [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials), then:

```yaml
  - uses: aws-actions/configure-aws-credentials@v4
    ...
  - uses: runs-on/cache@v4
    with:
      ...
    env:
      RUNS_ON_S3_BUCKET_CACHE: name-of-your-bucket
```

Be aware of S3 transfer costs if your runners are not in the same AWS region as your bucket.

## Special environment variables

* `RUNS_ON_S3_BUCKET_CACHE`: if set, the action will use this bucket to store the cache.
* `RUNS_ON_S3_BUCKET_ENDPOINT`: if set, the action will use this endpoint to connect to the bucket. This is useful if you are using AWS's S3 transfer acceleration or a non-AWS S3-compatible service.
* `RUNS_ON_RUNNER_NAME`: when running on RunsOn, where this environment variable is non-empty, existing AWS credentials from the environment will be discarded. If you want to preserve existing environment variables, set this to the empty string `""`.
* `RUNS_ON_S3_FORCE_PATH_STYLE` or `AWS_S3_FORCE_PATH_STYLE`: if one of those environment variables equals the string `"true"`, then the S3 client will be configured to force the path style.

