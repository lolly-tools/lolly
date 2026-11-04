#!/usr/bin/env python3
"""Publish release artifacts to the lolli.li bucket (UpCloud object storage).

  export LOLLI_S3_ACCESS_KEY=... LOLLI_S3_SECRET_KEY=...
  release/lolli.py ls
  release/lolli.py put <file> [key]           # key defaults to the basename
  release/lolli.py alias <alias-key> <target-key>
  release/lolli.py rm <key>
  release/lolli.py sums [--write]             # regenerate SHA256SUMS.txt

Credentials are read from the environment ONLY - never commit them. Mint a key
with the UpCloud API (the token is a `ucat_` API token, sent as
`Authorization: Bearer`, NOT HTTP Basic):

  curl -H "Authorization: Bearer $UPCLOUD_API_TOKEN" \
       https://api.upcloud.com/1.3/object-storage-2
  curl -X POST -H "Authorization: Bearer $UPCLOUD_API_TOKEN" \
       -H 'Content-Type: application/json' -d '{"username":"lolly-rel-key"}' \
       https://api.upcloud.com/1.3/object-storage-2/<uuid>/users/lolly-rel-key/access-keys

The secret is returned ONLY at creation and the user is capped at 2 keys.
"""
import hashlib, json, os, sys
from pathlib import Path
from urllib.request import urlopen
from subprocess import run
from datetime import datetime, timezone

ENDPOINT = os.environ.get("LOLLI_S3_ENDPOINT", "https://dq0o8.upcloudobjects.com")
REGION   = os.environ.get("LOLLI_S3_REGION", "europe-2")
BUCKET   = os.environ.get("LOLLI_S3_BUCKET", "lolly")

CONTENT_TYPES = {
    ".json": "application/json; charset=utf-8",
    ".sig": "text/plain; charset=utf-8",
    ".deb": "application/vnd.debian.binary-package",
    ".rpm": "application/x-rpm",
    ".zst": "application/zstd",
    ".txt": "text/plain; charset=utf-8",
}
# arch/ checksums live inside lolly.db; models/ is not part of a release.
SKIP_PREFIXES = ("models/", "arch/")
SKIP_KEYS = {"SHA256SUMS", "SHA256SUMS.txt"}


def client():
    import boto3
    from botocore.config import Config
    key = os.environ.get("LOLLI_S3_ACCESS_KEY")
    sec = os.environ.get("LOLLI_S3_SECRET_KEY")
    if not key or not sec:
        sys.exit("LOLLI_S3_ACCESS_KEY / LOLLI_S3_SECRET_KEY are not set")
    return boto3.client(
        "s3", endpoint_url=ENDPOINT, region_name=REGION,
        aws_access_key_id=key, aws_secret_access_key=sec,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 5},
            # The gateway is EMC/ViPR. Current botocore defaults to aws-chunked
            # streaming checksums, which it rejects mid-upload with
            # XAmzContentSHA256Mismatch on UploadPart.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_supported",
        ),
    )


def ctype(key):
    return CONTENT_TYPES.get(os.path.splitext(key)[1], "application/octet-stream")


def cmd_ls(c, args):
    for page in c.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
        for o in page.get("Contents", []):
            if not o["Key"].startswith("models/"):
                print(f"{o['Size']:>12}  {o['Key']}")


def cmd_put(c, args):
    local = args[0]
    key = args[1] if len(args) > 1 else os.path.basename(local)
    size = os.path.getsize(local)
    if key.startswith("updates/"):
        raise ValueError("Update pointers require promote-updates")
    upload(c, local, key)
    got = c.head_object(Bucket=BUCKET, Key=key)["ContentLength"]
    if got != size:
        sys.exit(f"FAILED {key}: uploaded {got} bytes, expected {size}")
    print(f"OK  {key}  {got} bytes  ({ctype(key)})")


def cmd_alias(c, args):
    alias, target = args[0], args[1]
    if alias.startswith(("updates/", "releases/")):
        raise ValueError("Release artifacts and update pointers cannot be aliased")
    c.copy_object(Bucket=BUCKET, Key=alias,
                  CopySource={"Bucket": BUCKET, "Key": target},
                  MetadataDirective="REPLACE", ContentType=ctype(target), CacheControl=cache_policy(alias))
    a = c.head_object(Bucket=BUCKET, Key=alias)["ContentLength"]
    t = c.head_object(Bucket=BUCKET, Key=target)["ContentLength"]
    print(f"{alias} -> {target}  {a} bytes  match={a == t}")


def cmd_rm(c, args):
    if args[0].startswith(("releases/", "updates/")):
        raise ValueError("Keep release objects; withdraw update offers through the release process")
    c.delete_object(Bucket=BUCKET, Key=args[0])
    print(f"deleted {args[0]}")


def cmd_sums(c, args):
    """Hash by STREAMING each object back, so the file cannot claim something
    the bucket does not actually serve."""
    keys = []
    for page in c.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
        for o in page.get("Contents", []):
            k = o["Key"]
            if not k.startswith(SKIP_PREFIXES) and k not in SKIP_KEYS:
                keys.append(k)

    sums = {}
    for k in sorted(keys):
        h = hashlib.sha256()
        body = c.get_object(Bucket=BUCKET, Key=k)["Body"]
        for chunk in iter(lambda: body.read(8 << 20), b""):
            h.update(chunk)
        sums[k] = h.hexdigest()
        print(f"  hashed {k}", file=sys.stderr)

    # Aliases are both "lolly-latest.<ext>" and the per-variant
    # "lolly-latest-<variant>.<ext>" (arm64, leap16) - matching only the dot
    # form files those under "Versioned", which reads as if they were pinned.
    aliases = sorted(k for k in sums if k.startswith(("lolly-latest.", "lolly-latest-")))
    out = ["# Lolly release checksums — verify with: sha256sum -c SHA256SUMS.txt",
           "# Stable aliases (always the newest build)"]
    out += [f"{sums[k]}  {k}" for k in aliases]
    out += ["# Versioned files"]
    out += [f"{sums[k]}  {k}" for k in sorted(k for k in sums if k not in aliases)]
    out += ["# Arch pacman repo (arch/x86_64/): package checksum lives in lolly.db"]
    text = "\n".join(out) + "\n"
    print(text)
    if "--write" in args:
        c.put_object(Bucket=BUCKET, Key="SHA256SUMS.txt", Body=text.encode(),
                     ContentType="text/plain; charset=utf-8")
        print("uploaded SHA256SUMS.txt", file=sys.stderr)


def cache_policy(key):
    return "public, max-age=31536000, immutable" if key.startswith("releases/") else "no-cache, max-age=0, must-revalidate"


def upload(c, local, key):
    extra = {"IfNoneMatch": "*"} if key.startswith("releases/") else {}
    try:
        with open(local, "rb") as body:
            c.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType=ctype(key),
                         CacheControl=cache_policy(key), **extra)
    except Exception as error:
        status = getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode")
        if not extra or status != 412:
            raise
        # An interrupted promotion may resume only against byte-identical immutable objects.
        remote = c.get_object(Bucket=BUCKET, Key=key)["Body"]
        digest = hashlib.sha256()
        for chunk in iter(lambda: remote.read(8 << 20), b""):
            digest.update(chunk)
        with open(local, "rb") as body:
            expected = hashlib.file_digest(body, "sha256").hexdigest()
        if digest.hexdigest() != expected:
            raise ValueError("Immutable release object already exists with different bytes") from error


def public_hash(url):
    h = hashlib.sha256()
    with urlopen(url, timeout=120) as response:
        for chunk in iter(lambda: response.read(8 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def cmd_promote(c, args):
    """Revalidate the candidate, upload immutable artifacts, verify public bytes, then promote."""
    plan_path = Path(args[0]).resolve()
    plan = json.loads(plan_path.read_text())
    # The generator rechecks trust, signatures, receipts and the platform release gates.
    verify_script = Path(__file__).with_name("validate-promotion.ts")
    run(["node", str(verify_script), str(plan_path)], check=True)
    for row in plan["artifacts"]:
        upload(c, row["path"], row["key"])
        upload(c, row["path"] + ".sig", row["key"] + ".sig")
        if public_hash(row["url"]) != row["sha256"]:
            raise ValueError("Public artifact checksum mismatch; pointers unchanged")
        signature_hash = hashlib.sha256(Path(row["path"] + ".sig").read_bytes()).hexdigest()
        if public_hash(row["url"] + ".sig") != signature_hash:
            raise ValueError("Public signature checksum mismatch; pointers unchanged")
    # Keep the previous pointers before changing any of them.
    previous = {}
    for key in plan["manifests"]:
        try:
            previous[key] = c.get_object(Bucket=BUCKET, Key=key)["Body"].read()
        except Exception as error:
            if getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
                raise
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    for key, body in previous.items():
        c.put_object(Bucket=BUCKET, Key=f"releases/{plan['version']}/previous/{stamp}/{key}",
                     Body=body, ContentType=ctype(key), CacheControl=cache_policy("releases/"), IfNoneMatch="*")
    for key, manifest in plan["manifests"].items():
        body = (json.dumps(manifest, indent=2) + "\n").encode()
        c.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType=ctype(key), CacheControl=cache_policy(key))
        if public_hash("https://lolli.li/" + key) != hashlib.sha256(body).hexdigest():
            raise ValueError("Public pointer readback failed; inspect promotion before retrying")


COMMANDS = {"promote-updates": cmd_promote, "ls": cmd_ls, "put": cmd_put, "alias": cmd_alias, "rm": cmd_rm, "sums": cmd_sums}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]](client(), sys.argv[2:])
