#!/usr/bin/env python3
# SPDX-License-Identifier: MPL-2.0
"""Prepare, verify and sign a finished iOS archive without running its code."""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import plistlib
import re
import secrets
import shlex
import shutil
import signal
import stat
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
MAX_BYTES = 2 * 1024**3
MAX_FILES = 100000
ARCHIVE = "Lolly.xcarchive"
CLI_VERSION = "2.12.1"
MACHO = {b"\xcf\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xca\xfe\xba\xbe", b"\xbe\xba\xfe\xca"}


class ReleaseError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def regular_file(path, maximum):
    state = path.lstat()
    require(stat.S_ISREG(state.st_mode) and state.st_nlink == 1 and state.st_size <= maximum, "An artifact file is invalid.")


def tool_env():
    return {key: os.environ[key] for key in ("HOME", "TMPDIR", "DEVELOPER_DIR") if key in os.environ} | {"PATH": "/usr/bin:/bin:/usr/sbin:/sbin"}


def install_signal_handlers():
    def interrupted(_number, _frame):
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        raise ReleaseError("The release process was interrupted.")
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGTERM, interrupted)


def run(args, capture=False, private_key_dir=None):
    environment = tool_env()
    if private_key_dir is not None:
        environment["API_PRIVATE_KEYS_DIR"] = private_key_dir
    child = subprocess.Popen(args, env=environment, cwd=os.environ.get("RUNNER_TEMP", "/"),
                             stdout=subprocess.PIPE if capture else None, stderr=subprocess.PIPE if capture else None,
                             start_new_session=True)
    try:
        output, _errors = child.communicate(timeout=900)
    except BaseException:
        try:
            os.killpg(child.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            child.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.communicate()
        raise
    require(child.returncode == 0, "An Apple release tool failed.")
    return output if capture else b""


def public_configuration():
    config = json.loads((ROOT / "shells/tauri-mobile/src-tauri/tauri.conf.json").read_text())
    value = {"bundle": config["identifier"], "version": config["version"], "team": config["bundle"]["iOS"]["developmentTeam"]}
    require(re.fullmatch(r"[A-Za-z0-9.-]+", value["bundle"]), "The configured bundle ID is invalid.")
    require(re.fullmatch(r"[A-Z0-9]{10}", value["team"]), "An approved Apple team is required.")
    require(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", value["version"]), "A numeric release version is required.")
    return value


def safe_path(name):
    parts = PurePosixPath(name).parts
    require(name and not name.startswith("/") and "\\" not in name and not any(ord(c) < 32 for c in name), "An artifact path is invalid.")
    require(len(parts) <= 32 and all(part not in (".", "..") for part in parts) and str(PurePosixPath(name)) == name.rstrip("/"), "An artifact path is invalid.")
    return parts


def tree(path):
    require(path.is_dir() and not path.is_symlink(), "The archive directory is missing.")
    files, directories, total = {}, [], 0
    for base, dirs, names in os.walk(path, followlinks=False):
        for name in sorted(dirs + names):
            file = Path(base) / name
            relative = file.relative_to(path).as_posix()
            safe_path(relative)
            mode = file.lstat().st_mode
            require(not stat.S_ISLNK(mode) and not mode & 0o7000, "Links and special permissions are not accepted.")
            require(len(files) + len(directories) < MAX_FILES, "The archive has too many entries.")
            if stat.S_ISDIR(mode):
                directories.append(relative)
            else:
                require(stat.S_ISREG(mode) and file.stat().st_nlink == 1, "Only independent regular files are accepted.")
                total += file.stat().st_size
                require(total <= MAX_BYTES, "The archive is too large.")
                files[relative] = {"sha256": file_digest(file), "mode": stat.S_IMODE(mode), "size": file.stat().st_size}
    return {"files": files, "directories": sorted(directories)}


def inspect_archive(archive, expected):
    properties = plistlib.loads((archive / "Info.plist").read_bytes())["ApplicationProperties"]
    apps = sorted((archive / "Products/Applications").glob("*.app"))
    require(len(apps) == 1 and apps[0].name == "Lolly.app", "Exactly the approved application is required.")
    app = apps[0]
    require(properties["ApplicationPath"] == "Applications/Lolly.app", "The archive application path differs.")
    info = plistlib.loads((app / "Info.plist").read_bytes())
    require(info["CFBundleIdentifier"] == expected["bundle"] and info["CFBundleShortVersionString"] == expected["version"] and info["CFBundleVersion"] == expected["version"], "The application identity or version differs.")
    require(isinstance(info.get("BuildMachineOSBuild"), str) and re.fullmatch(r"[0-9]{2}[A-Z][0-9]+[a-z]?", info["BuildMachineOSBuild"]) and not re.fullmatch(r"[0-9]{2}[A-Z]5[0-9]{3}[a-z]", info["BuildMachineOSBuild"]), "A released macOS archive is required.")
    require(re.fullmatch(r"iphoneos(2[6-9]|[3-9][0-9])\.[0-9]+", info.get("DTSDKName", "")), "An iOS 26 or later device SDK is required.")
    executable = info["CFBundleExecutable"]
    require(re.fullmatch(r"[A-Za-z0-9._-]+", executable), "The application executable is invalid.")
    main = app / executable
    with main.open("rb") as stream:
        require(stream.read(8) == b"\xcf\xfa\xed\xfe\x0c\x00\x00\x01", "An arm64 device executable is required.")
    require(main.stat().st_mode & 0o111, "The application executable permission is missing.")
    require(not (app / "embedded.mobileprovision").exists(), "The build archive must not carry a provisioning profile.")
    frameworks, libraries = [], []
    for file in app.rglob("*"):
        require(file.suffix not in (".appex", ".xpc", ".app"), "Additional executable targets need an approved signing policy.")
        if file.is_dir() and file.suffix == ".framework":
            frameworks.append(file.relative_to(archive).as_posix())
        elif file.is_file():
            with file.open("rb") as stream:
                native = stream.read(4) in MACHO
            if file.suffix == ".dylib":
                require(native, "A native library is invalid.")
                if not any(parent.suffix == ".framework" for parent in file.parents):
                    libraries.append(file.relative_to(archive).as_posix())
            elif native and file != main:
                require(any(parent.suffix == ".framework" for parent in file.parents), "An additional executable needs an approved signing policy.")
    return {"app": app.relative_to(archive).as_posix(), "code": sorted(frameworks + libraries, key=lambda p: (-len(PurePosixPath(p).parts), p))}


def validate_receipt(receipt, args):
    require(receipt.get("kind") == "lolly-ios-unsigned-archive" and receipt.get("version") == 1, "The archive receipt is invalid.")
    require(re.fullmatch(r"[a-f0-9]{40}", args.source) and receipt.get("source") == args.source, "The archive source differs.")
    require(re.fullmatch(r"[0-9]+", args.run_id) and re.fullmatch(r"[0-9]+", args.run_attempt) and receipt.get("runId") == args.run_id and receipt.get("runAttempt") == args.run_attempt, "The archive workflow run differs.")
    require(receipt.get("target") == "tauri-mobile" and receipt.get("profile") == "lolly-start" and receipt.get("tauriCli") == CLI_VERSION, "The archive target, profile or CLI differs.")
    require(receipt.get("application") == public_configuration(), "The archive application configuration differs.")


def prepare(args):
    require(not any(value for key, value in os.environ.items() if re.search(r"^(IOS_DIST_|IOS_APP_STORE_PROFILE$|ASC_|APPLE_API_|TAURI_SIGNING_|LOLLY_CATALOG_SIGNING_KEY$)", key)), "Compilation must not receive release credentials.")
    cli = json.loads((ROOT / "shells/tauri-mobile/node_modules/@tauri-apps/cli/package.json").read_text())
    require(cli["version"] == CLI_VERSION, "The installed Tauri CLI differs from the qualified version.")
    expected = public_configuration()
    contents = tree(args.archive)
    inspect_archive(args.archive, expected)
    unsigned = subprocess.run(["/usr/bin/codesign", "-d", str(args.archive / "Products/Applications/Lolly.app")], env=tool_env(), capture_output=True)
    require(unsigned.returncode != 0 and b"not signed at all" in unsigned.stderr, "The application archive must be unsigned.")
    entitlements = ROOT / "shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile_iOS/lolly-mobile_iOS.entitlements"
    require(plistlib.loads(entitlements.read_bytes()) == {}, "Additional entitlements need an approved release policy.")
    args.output.mkdir(parents=True, exist_ok=False)
    archive_tar = args.output / "archive.tar"
    with tarfile.open(archive_tar, "w") as output:
        output.add(args.archive, arcname=ARCHIVE)
    receipt = {"kind": "lolly-ios-unsigned-archive", "version": 1, "source": args.source,
               "runId": args.run_id, "runAttempt": args.run_attempt, "target": "tauri-mobile", "profile": "lolly-start",
               "tauriCli": CLI_VERSION, "application": expected, "contents": contents,
               "archiveSha256": file_digest(archive_tar), "frontendReceiptSha256": file_digest(args.frontend / "release-frontend.sig.json"),
               "xcode": run(["/usr/bin/xcodebuild", "-version"], True).decode().strip()}
    validate_receipt(receipt, args)
    receipt_file = args.output / "receipt.json"
    receipt_file.write_text(json.dumps(receipt, sort_keys=True, separators=(",", ":")) + "\n")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as output:
            output.write("receipt_sha=" + file_digest(receipt_file) + "\n")


def verify(args):
    require(args.input.is_dir() and not args.input.is_symlink() and {path.name for path in args.input.iterdir()} == {"receipt.json", "archive.tar"}, "The artifact directory is invalid.")
    regular_file(args.input / "receipt.json", 32 * 1024**2)
    regular_file(args.input / "archive.tar", MAX_BYTES + MAX_FILES * 1024)
    require(re.fullmatch(r"[a-f0-9]{64}", args.receipt_sha) and file_digest(args.input / "receipt.json") == args.receipt_sha, "The immutable artifact receipt differs.")
    receipt = json.loads((args.input / "receipt.json").read_text())
    validate_receipt(receipt, args)
    require(receipt["frontendReceiptSha256"] == file_digest(args.frontend / "release-frontend.sig.json"), "The signed frontend receipt differs.")
    require(receipt["xcode"] == run(["/usr/bin/xcodebuild", "-version"], True).decode().strip(), "The signing Xcode differs from the compiler.")
    archive_tar = args.input / "archive.tar"
    require(archive_tar.stat().st_size <= MAX_BYTES + MAX_FILES * 1024 and receipt["archiveSha256"] == file_digest(archive_tar), "The archive bytes differ.")
    args.output.mkdir(parents=True, exist_ok=False)
    try:
        with tarfile.open(archive_tar, "r:") as source:
            seen, total = set(), 0
            for entry in source:
                parts = safe_path(entry.name)
                require(parts[0] == ARCHIVE and entry.name not in seen and len(seen) < MAX_FILES and not entry.mode & 0o7000, "The archive layout is invalid.")
                seen.add(entry.name)
                target = args.output.joinpath(*parts)
                if entry.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    require(entry.isfile(), "Links and special archive entries are not accepted.")
                    total += entry.size
                    require(total <= MAX_BYTES, "The archive is too large.")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with target.open("xb") as output, source.extractfile(entry) as content:
                        shutil.copyfileobj(content, output)
                    target.chmod(entry.mode)
        archive = args.output / ARCHIVE
        require(tree(archive) == receipt["contents"], "The archive files or permissions differ.")
        inspect_archive(archive, receipt["application"])
        shutil.copyfile(args.input / "receipt.json", args.output / "receipt.json")
    except Exception:
        shutil.rmtree(args.output)
        raise


def profile_policy(profile, expected, now):
    require(profile.get("TeamIdentifier") == [expected["team"]] and profile.get("Platform") == ["iOS"], "The provisioning team or platform differs.")
    require(isinstance(profile.get("ExpirationDate"), datetime.datetime) and profile["ExpirationDate"] > now + datetime.timedelta(hours=1), "The provisioning profile is expired or near expiry.")
    require(isinstance(profile.get("CreationDate"), datetime.datetime) and profile["CreationDate"] <= now + datetime.timedelta(minutes=5), "The provisioning profile date is invalid.")
    require(not profile.get("ProvisionedDevices") and not profile.get("ProvisionsAllDevices"), "An App Store provisioning profile is required.")
    prefixes = profile.get("ApplicationIdentifierPrefix", [])
    require(len(prefixes) == 1 and re.fullmatch(r"[A-Z0-9]{10}", prefixes[0]), "An explicit application prefix is required.")
    identifier = prefixes[0] + "." + expected["bundle"]
    permitted = profile.get("Entitlements", {})
    require(permitted.get("application-identifier") == identifier and permitted.get("com.apple.developer.team-identifier") == expected["team"] and permitted.get("get-task-allow") is False and permitted.get("beta-reports-active") is True, "The App Store identity or entitlements differ.")
    require(identifier in permitted.get("keychain-access-groups", []) or prefixes[0] + ".*" in permitted.get("keychain-access-groups", []), "The application keychain group is not permitted.")
    require(re.fullmatch(r"[A-Fa-f0-9-]{36}", profile.get("UUID", "")), "The provisioning profile ID is invalid.")
    certificates = profile.get("DeveloperCertificates", [])
    require(certificates and all(isinstance(cert, bytes) for cert in certificates), "The provisioning certificate is missing.")
    entitlements = {"application-identifier": identifier, "com.apple.developer.team-identifier": expected["team"],
                    "get-task-allow": False, "beta-reports-active": True, "keychain-access-groups": [identifier]}
    return entitlements, {hashlib.sha1(cert).hexdigest().upper() for cert in certificates}


def decode_secret(name, limit):
    encoded = os.environ.get(name, "")
    require(encoded and len(encoded) <= limit * 2, "Required release credential configuration is missing.")
    decoded = base64.b64decode(encoded, validate=True)
    require(0 < len(decoded) <= limit, "A release credential is invalid.")
    return decoded


def sign(args):
    receipt_file = args.input / "receipt.json"
    require(args.input.is_dir() and not args.input.is_symlink() and {path.name for path in args.input.iterdir()} == {"receipt.json", ARCHIVE}, "The prepared directory is invalid.")
    regular_file(receipt_file, 32 * 1024**2)
    require(file_digest(receipt_file) == args.receipt_sha, "The prepared receipt differs.")
    receipt = json.loads(receipt_file.read_text())
    validate_receipt(receipt, args)
    archive = args.input / ARCHIVE
    require(tree(archive) == receipt["contents"], "The prepared archive changed.")
    plan = inspect_archive(archive, receipt["application"])
    require(receipt["xcode"] == run(["/usr/bin/xcodebuild", "-version"], True).decode().strip(), "The signing Xcode differs.")
    require(not args.output.exists(), "The signing output directory already exists.")
    owned_profiles = []
    prior_keychains = shlex.split(run(["/usr/bin/security", "list-keychains", "-d", "user"], True).decode())
    with tempfile.TemporaryDirectory(prefix="lolly-ios-sign-", dir=os.environ.get("RUNNER_TEMP")) as temporary:
        work = Path(temporary)
        keychain = work / "release.keychain-db"
        keychain_created = False
        try:
            profile_file = work / "profile.mobileprovision"
            profile_file.write_bytes(decode_secret("IOS_APP_STORE_PROFILE", 1024 * 1024))
            profile = plistlib.loads(run(["/usr/bin/security", "cms", "-D", "-i", str(profile_file)], True))
            entitlements, permitted_certificates = profile_policy(profile, receipt["application"], datetime.datetime.utcnow())
            p12 = work / "distribution.p12"
            p12.write_bytes(decode_secret("IOS_DIST_CERT_P12", 1024 * 1024))
            p12.chmod(0o600)
            password = os.environ.get("IOS_DIST_CERT_PASSWORD")
            require(password is not None, "The distribution certificate password is missing.")
            keychain_password = secrets.token_urlsafe(32)
            run(["/usr/bin/security", "create-keychain", "-p", keychain_password, str(keychain)])
            keychain_created = True
            run(["/usr/bin/security", "set-keychain-settings", "-lut", "3600", str(keychain)])
            run(["/usr/bin/security", "unlock-keychain", "-p", keychain_password, str(keychain)])
            run(["/usr/bin/security", "import", str(p12), "-k", str(keychain), "-P", password, "-T", "/usr/bin/codesign", "-T", "/usr/bin/xcodebuild"], True)
            p12.unlink()
            run(["/usr/bin/security", "set-key-partition-list", "-S", "apple-tool:,apple:", "-s", "-k", keychain_password, str(keychain)], True)
            identities = run(["/usr/bin/security", "find-identity", "-v", "-p", "codesigning", str(keychain)], True).decode()
            matches = re.findall(r'\b([A-F0-9]{40}) "((?:Apple Distribution|iPhone Distribution):[^"\r\n]+)"', identities)
            matches = [(identity, name) for identity, name in matches if identity in permitted_certificates and name.endswith("(" + receipt["application"]["team"] + ")")]
            require(len(matches) == 1, "Exactly the approved valid distribution certificate is required.")
            identity, identity_name = matches[0]
            run(["/usr/bin/security", "list-keychains", "-d", "user", "-s", str(keychain), *prior_keychains])
            for directory in (Path.home() / "Library/MobileDevice/Provisioning Profiles", Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles"):
                directory.mkdir(parents=True, exist_ok=True)
                destination = directory / (profile["UUID"] + ".mobileprovision")
                if destination.exists():
                    require(destination.read_bytes() == profile_file.read_bytes(), "A different provisioning profile is already installed.")
                else:
                    destination.write_bytes(profile_file.read_bytes())
                    owned_profiles.append(destination)
            app = archive / plan["app"]
            shutil.copyfile(profile_file, app / "embedded.mobileprovision")
            entitlement_file = work / "Entitlements.plist"
            entitlement_file.write_bytes(plistlib.dumps(entitlements))
            for relative in plan["code"]:
                run(["/usr/bin/codesign", "--force", "--sign", identity, "--keychain", str(keychain), str(archive / relative)])
            run(["/usr/bin/codesign", "--force", "--sign", identity, "--keychain", str(keychain), "--entitlements", str(entitlement_file), str(app)])
            run(["/usr/bin/codesign", "--verify", "--deep", "--strict", str(app)])
            archive_info = plistlib.loads((archive / "Info.plist").read_bytes())
            archive_info["ApplicationProperties"].update({"SigningIdentity": identity_name, "Team": receipt["application"]["team"]})
            (archive / "Info.plist").write_bytes(plistlib.dumps(archive_info))
            options = {"method": "app-store-connect", "destination": "export", "signingStyle": "manual", "teamID": receipt["application"]["team"],
                       "signingCertificate": identity, "provisioningProfiles": {receipt["application"]["bundle"]: profile["UUID"]},
                       "manageAppVersionAndBuildNumber": False, "uploadSymbols": True}
            options_file = work / "ExportOptions.plist"
            options_file.write_bytes(plistlib.dumps(options))
            run(["/usr/bin/xcodebuild", "-exportArchive", "-archivePath", str(archive), "-exportPath", str(args.output), "-exportOptionsPlist", str(options_file)])
            ipas = list(args.output.glob("*.ipa"))
            require(len(ipas) == 1, "Exactly one exported IPA is required.")
            with zipfile.ZipFile(ipas[0]) as ipa:
                info = plistlib.loads(ipa.read("Payload/Lolly.app/Info.plist"))
                require(info["CFBundleIdentifier"] == receipt["application"]["bundle"] and info["CFBundleShortVersionString"] == receipt["application"]["version"] and info["CFBundleVersion"] == receipt["application"]["version"], "The exported application identity or version differs.")
            shutil.copyfile(ipas[0], args.output / "Lolly.ipa") if ipas[0].name != "Lolly.ipa" else None
            (args.output / "release.json").write_text(json.dumps({"source": args.source, "runId": args.run_id, "runAttempt": args.run_attempt,
                "unsignedReceiptSha256": args.receipt_sha, "ipaSha256": file_digest(args.output / "Lolly.ipa")}, sort_keys=True) + "\n")
        finally:
            profiles_removed = True
            for profile in owned_profiles:
                try:
                    profile.unlink(missing_ok=True)
                except OSError:
                    profiles_removed = False
            cleanup_ok = profiles_removed
            try:
                restored = subprocess.run(["/usr/bin/security", "list-keychains", "-d", "user", "-s", *prior_keychains], env=tool_env(), capture_output=True, timeout=20)
                cleanup_ok = cleanup_ok and restored.returncode == 0
            except (OSError, subprocess.TimeoutExpired):
                cleanup_ok = False
            if keychain_created:
                try:
                    deleted = subprocess.run(["/usr/bin/security", "delete-keychain", str(keychain)], env=tool_env(), capture_output=True, timeout=20)
                    cleanup_ok = cleanup_ok and deleted.returncode == 0
                except (OSError, subprocess.TimeoutExpired):
                    cleanup_ok = False
            require(cleanup_ok, "Signing credential cleanup failed.")


def upload(args):
    record = json.loads((args.input / "release.json").read_text())
    require(record["ipaSha256"] == file_digest(args.input / "Lolly.ipa"), "The IPA changed after export.")
    key_id, issuer = os.environ.get("ASC_KEY_ID", ""), os.environ.get("ASC_ISSUER_ID", "")
    require(re.fullmatch(r"[A-Z0-9]{10}", key_id) and re.fullmatch(r"[a-fA-F0-9-]{36}", issuer), "App Store upload configuration is missing.")
    with tempfile.TemporaryDirectory(prefix="lolly-ios-upload-", dir=os.environ.get("RUNNER_TEMP")) as temporary:
        key = Path(temporary) / ("AuthKey_" + key_id + ".p8")
        key.write_bytes(decode_secret("ASC_KEY_P8", 65536))
        key.chmod(0o600)
        run(["/usr/bin/xcrun", "altool", "--upload-app", "-f", str(args.input / "Lolly.ipa"), "-t", "ios", "--apiKey", key_id, "--apiIssuer", issuer], private_key_dir=temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("prepare", "verify", "sign", "upload"):
        sub = commands.add_parser(command)
        sub.add_argument("--input", type=Path, required=True) if command != "prepare" else sub.add_argument("--archive", type=Path, required=True)
        if command != "upload":
            for name in ("source", "run-id", "run-attempt"):
                sub.add_argument("--" + name, required=True)
            sub.add_argument("--output", type=Path, required=True)
        if command in ("verify", "sign"):
            sub.add_argument("--receipt-sha", required=True)
        if command in ("prepare", "verify"):
            sub.add_argument("--frontend", type=Path, required=True)
    args = parser.parse_args()
    install_signal_handlers()
    try:
        globals()[args.command](args)
    except ReleaseError as error:
        parser.exit(1, "iOS release processing stopped: " + str(error) + "\n")
    except Exception:
        parser.exit(1, "iOS release artifact validation or processing failed; check the artifact, approved profile and platform configuration.\n")


if __name__ == "__main__":
    main()
