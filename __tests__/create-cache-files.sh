#!/bin/sh

# Validate args
prefix="$1"
if [ -z "$prefix" ]; then
  echo "Must supply prefix argument"
  exit 1
fi

mkdir test-cache
echo "$prefix $GITHUB_RUN_ID" > test-cache/test-file.txt