# RunsOn cache action

This action is a drop-in replacement for the official `actions/cache@v4` action, for use with the [RunsOn](https://runs-on.com) self-hosted GitHub Action runner provider.

![image](https://github.com/runs-on/cache/assets/6114/e61c5b6f-aa86-48be-9e1b-baac6dce9b84)

It will automatically store your caches in a dedicated RunsOn S3 bucket that lives close to your self-hosted runners, ensuring you get at least 200MiB/s download and upload throughput when using caches in your workflows.

If no S3 bucket is provided, it will also transparently switch to the default behaviour. This means you can use this action and switch between RunsOn runners and official GitHub runners with no change.


## Usage

Simply replace `actions/cache@v4` with `runs-on/cache@v4`. All the official options are supported. 

Please refer to [actions/cache](https://github.com/actions/cache) for usage.
