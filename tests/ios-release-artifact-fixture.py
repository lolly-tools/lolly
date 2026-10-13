# SPDX-License-Identifier: MPL-2.0
import datetime
import base64
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import tarfile
import tempfile
import time
from types import SimpleNamespace
import unittest
import zipfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ios_release_artifact", Path(__file__).resolve().parent.parent / "scripts/ios-release-artifact.py")
artifact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(artifact)


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.addCleanup(patch.stopall)
        patch.object(artifact, "ROOT", self.root).start()
        patch.dict(os.environ, {}, clear=True).start()
        config = self.root / "shells/tauri-mobile/src-tauri/tauri.conf.json"
        config.parent.mkdir(parents=True)
        config.write_text(json.dumps({"identifier": "tools.example.mobile", "version": "1.1.0", "bundle": {"iOS": {"developmentTeam": "0123456789"}}}))
        cli = self.root / "shells/tauri-mobile/node_modules/@tauri-apps/cli/package.json"
        cli.parent.mkdir(parents=True)
        cli.write_text(json.dumps({"version": "2.12.1"}))
        entitlement = config.parent / "gen/apple/lolly-mobile_iOS/lolly-mobile_iOS.entitlements"
        entitlement.parent.mkdir(parents=True)
        entitlement.write_bytes(plistlib.dumps({}))
        self.archive = self.root / "input.xcarchive"
        self.app = self.archive / "Products/Applications/Lolly.app"
        self.app.mkdir(parents=True)
        self.info = {"CFBundleIdentifier": "tools.example.mobile", "CFBundleShortVersionString": "1.1.0", "CFBundleVersion": "1.1.0",
                     "CFBundleExecutable": "Lolly", "BuildMachineOSBuild": "24G100", "DTSDKName": "iphoneos26.1"}
        self.write_info()
        (self.archive / "Info.plist").write_bytes(plistlib.dumps({"ApplicationProperties": {"ApplicationPath": "Applications/Lolly.app"}}))
        (self.app / "Lolly").write_bytes(b"\xcf\xfa\xed\xfe\x0c\x00\x00\x01" + bytes(100))
        (self.app / "Lolly").chmod(0o755)
        self.frontend = self.root / "frontend"
        self.frontend.mkdir()
        (self.frontend / "release-frontend.sig.json").write_text("signed fixture receipt")
        self.record = []
        self.xcode = b"Xcode 26.1\nBuild version 17B55"
        patch.object(artifact, "run", self.run_tool).start()
        patch.object(artifact.subprocess, "run", return_value=SimpleNamespace(returncode=1, stderr=b"code object is not signed at all")).start()
        self.args = SimpleNamespace(archive=self.archive, frontend=self.frontend, output=self.root / "artifact", source="a" * 40, run_id="123", run_attempt="2")

    def write_info(self):
        (self.app / "Info.plist").write_bytes(plistlib.dumps(self.info))

    def run_tool(self, args, capture=False):
        self.record.append(args)
        if args == ["/usr/bin/xcodebuild", "-version"]:
            return self.xcode
        raise AssertionError("Unexpected release tool")

    def prepared(self):
        artifact.prepare(self.args)
        args = SimpleNamespace(**vars(self.args))
        args.input, args.output = self.args.output, self.root / "verified"
        args.receipt_sha = artifact.file_digest(args.input / "receipt.json")
        return args

    def rewrite_tar(self, args, name, kind=None):
        with tarfile.open(args.input / "archive.tar", "w") as tar:
            entry = tarfile.TarInfo(name)
            if kind:
                entry.type, entry.linkname = kind, "/outside"
            else:
                entry.size = 1
            tar.addfile(entry, None if kind else io.BytesIO(b"x"))
        receipt = json.loads((args.input / "receipt.json").read_text())
        receipt["archiveSha256"] = artifact.file_digest(args.input / "archive.tar")
        (args.input / "receipt.json").write_text(json.dumps(receipt))
        args.receipt_sha = artifact.file_digest(args.input / "receipt.json")

    def test_archive_roundtrip_preserves_byte_and_executable_receipt(self):
        args = self.prepared()
        artifact.verify(args)
        archive = args.output / artifact.ARCHIVE
        self.assertEqual(artifact.tree(archive), artifact.tree(self.archive))
        self.assertEqual((archive / "Products/Applications/Lolly.app/Lolly").stat().st_mode & 0o777, 0o755)

    def test_scope_and_receipt_edits_fail_before_extraction(self):
        for field, value in [("source", "b" * 40), ("run_id", "124"), ("run_attempt", "3"), ("receipt_sha", "b" * 64)]:
            with self.subTest(field=field):
                args = self.prepared() if not self.args.output.exists() else SimpleNamespace(input=self.args.output, output=self.root / "verified", frontend=self.frontend,
                    source=self.args.source, run_id=self.args.run_id, run_attempt=self.args.run_attempt, receipt_sha=artifact.file_digest(self.args.output / "receipt.json"))
                setattr(args, field, value)
                with self.assertRaises(ValueError):
                    artifact.verify(args)
                self.assertFalse(args.output.exists())

    def test_tar_edits_and_frontend_substitution_are_refused(self):
        args = self.prepared()
        archive_tar = args.input / "archive.tar"
        original = archive_tar.read_bytes()
        archive_tar.write_bytes(original + b"changed")
        with self.assertRaises(ValueError):
            artifact.verify(args)
        archive_tar.write_bytes(original)
        (self.frontend / "release-frontend.sig.json").write_text("different signed frontend")
        with self.assertRaises(ValueError):
            artifact.verify(args)

    def test_compiler_cannot_receive_release_credentials(self):
        for name in ("IOS_DIST_CERT_P12", "IOS_APP_STORE_PROFILE", "ASC_KEY_P8", "APPLE_API_KEY_PATH", "LOLLY_CATALOG_SIGNING_KEY", "TAURI_SIGNING_PRIVATE_KEY"):
            with self.subTest(name=name), patch.dict(os.environ, {name: "fixture"}):
                with self.assertRaises(ValueError):
                    artifact.prepare(self.args)
                self.assertFalse(self.args.output.exists())

    def test_source_links_and_hard_links_are_refused(self):
        link = self.app / "linked"
        link.symlink_to(self.app / "Lolly")
        with self.assertRaises(ValueError):
            artifact.prepare(self.args)
        link.unlink()
        os.link(self.app / "Lolly", link)
        with self.assertRaises(ValueError):
            artifact.prepare(self.args)

    def test_archive_paths_and_link_entries_are_refused_even_with_a_matching_receipt(self):
        args = self.prepared()
        for name, kind in [("../outside", None), ("/outside", None), ("Lolly.xcarchive/../../outside", None), ("Lolly.xcarchive/link", tarfile.SYMTYPE), ("Lolly.xcarchive/link", tarfile.LNKTYPE)]:
            with self.subTest(name=name, kind=kind):
                self.rewrite_tar(args, name, kind)
                with self.assertRaises(ValueError):
                    artifact.verify(args)
                self.assertFalse(args.output.exists())
        self.assertFalse((self.root / "outside").exists())

    def test_beta_simulator_identity_and_version_mismatches_are_refused(self):
        for key, value in [("BuildMachineOSBuild", "24G5123a"), ("DTSDKName", "iphonesimulator26.1"), ("DTSDKName", "iphoneos25.1"),
                           ("CFBundleIdentifier", "other.example"), ("CFBundleVersion", "2.0.0"), ("CFBundleExecutable", "../elsewhere")]:
            with self.subTest(key=key):
                old = self.info[key]
                self.info[key] = value
                self.write_info()
                with self.assertRaises(ValueError):
                    artifact.prepare(self.args)
                self.info[key] = old
                self.write_info()

    def test_additional_targets_entitlements_and_platform_tool_changes_are_refused(self):
        extension = self.app / "Extra.appex"
        extension.mkdir()
        with self.assertRaises(ValueError):
            artifact.prepare(self.args)
        extension.rmdir()
        entitlements = self.root / "shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile_iOS/lolly-mobile_iOS.entitlements"
        entitlements.write_bytes(plistlib.dumps({"unapproved-capability": True}))
        with self.assertRaises(ValueError):
            artifact.prepare(self.args)
        entitlements.write_bytes(plistlib.dumps({}))
        args = self.prepared()
        self.xcode = b"Xcode 26.2\nBuild version 17C1"
        with self.assertRaises(ValueError):
            artifact.verify(args)

    def test_prepared_mutation_fails_before_private_key_access(self):
        args = self.prepared()
        artifact.verify(args)
        args.input = args.output
        args.output = self.root / "signed"
        (args.input / artifact.ARCHIVE / "Products/Applications/Lolly.app/Lolly").write_bytes(b"different")
        with patch.object(artifact, "decode_secret", side_effect=AssertionError("Credentials must not be read")):
            with self.assertRaises(ValueError):
                artifact.sign(args)

    def signing_fixture(self, fail_export=False):
        args = self.prepared()
        artifact.verify(args)
        args.input, args.output = args.output, self.root / "signed"
        profile_tests = ProfileTests()
        profile_tests.setUp()
        profile = profile_tests.profile
        profile["CreationDate"] = datetime.datetime.utcnow() - datetime.timedelta(days=1)
        profile["ExpirationDate"] = datetime.datetime.utcnow() + datetime.timedelta(days=30)
        certificate = hashlib.sha1(profile["DeveloperCertificates"][0]).hexdigest().upper()
        os.environ.update({"HOME": str(self.root / "home"), "RUNNER_TEMP": str(self.root), "IOS_DIST_CERT_P12": base64.b64encode(b"disposable identity fixture").decode(),
                           "IOS_DIST_CERT_PASSWORD": "fixture-password", "IOS_APP_STORE_PROFILE": base64.b64encode(b"disposable CMS fixture").decode()})
        Path(os.environ["HOME"]).mkdir()
        def release_tool(command, capture=False):
            self.record.append(command)
            if command == ["/usr/bin/xcodebuild", "-version"]:
                return self.xcode
            if command[:3] == ["/usr/bin/security", "list-keychains", "-d"] and len(command) == 4:
                return b'"/fixture/login.keychain-db"'
            if command[:3] == ["/usr/bin/security", "cms", "-D"]:
                return plistlib.dumps(profile)
            if command[:2] == ["/usr/bin/security", "find-identity"]:
                return (certificate + ' "Apple Distribution: Example (0123456789)"').encode()
            if command[:2] == ["/usr/bin/xcodebuild", "-exportArchive"]:
                if fail_export:
                    raise ValueError("Export qualification failed")
                args.output.mkdir()
                with zipfile.ZipFile(args.output / "Lolly.ipa", "w") as ipa:
                    ipa.writestr("Payload/Lolly.app/Info.plist", plistlib.dumps(self.info))
            return b""
        patch.object(artifact, "run", release_tool).start()
        cleanup = patch.object(artifact.subprocess, "run", return_value=SimpleNamespace(returncode=0)).start()
        return args, cleanup

    def test_signer_only_calls_artifact_sign_export_tools_and_removes_credential_files(self):
        args, cleanup = self.signing_fixture()
        artifact.sign(args)
        self.assertTrue((args.output / "Lolly.ipa").is_file())
        commands = self.record
        self.assertTrue(any(command[0:2] == ["/usr/bin/xcodebuild", "-exportArchive"] for command in commands))
        self.assertTrue(all(command[0] in ("/usr/bin/security", "/usr/bin/codesign", "/usr/bin/xcodebuild") for command in commands))
        self.assertFalse(any("-project" in command or "-workspace" in command or "-allowProvisioningUpdates" in command for command in commands))
        self.assertTrue(any(call.args[0][1] == "delete-keychain" for call in cleanup.call_args_list))
        self.assertFalse(list(self.root.glob("lolly-ios-sign-*")))
        self.assertFalse(list((self.root / "home").rglob("*.mobileprovision")))

    def test_export_failure_still_restores_keychains_and_removes_profile_and_key_files(self):
        args, cleanup = self.signing_fixture(fail_export=True)
        with self.assertRaises(ValueError):
            artifact.sign(args)
        self.assertTrue(any(call.args[0][1] == "delete-keychain" for call in cleanup.call_args_list))
        self.assertFalse(list(self.root.glob("lolly-ios-sign-*")))
        self.assertFalse(list((self.root / "home").rglob("*.mobileprovision")))

    def test_cleanup_failure_still_attempts_private_key_deletion_and_stops_release(self):
        args, cleanup = self.signing_fixture()
        def failed_restore(command, **kwargs):
            if command[1] == "list-keychains":
                raise subprocess.TimeoutExpired(command, 20)
            return SimpleNamespace(returncode=0)
        cleanup.side_effect = failed_restore
        with self.assertRaisesRegex(ValueError, "Signing credential cleanup failed"):
            artifact.sign(args)
        self.assertTrue(any(call.args[0][1] == "delete-keychain" for call in cleanup.call_args_list))
        self.assertFalse(list(self.root.glob("lolly-ios-sign-*")))
        self.assertFalse(list((self.root / "home").rglob("*.mobileprovision")))

    def test_signals_stop_a_real_subprocess_and_run_signing_cleanup(self):
        args = self.prepared()
        artifact.verify(args)
        args.input, args.output = args.output, self.root / "signed"
        profile_tests = ProfileTests()
        profile_tests.setUp()
        profile = profile_tests.profile
        profile["CreationDate"] = datetime.datetime.utcnow() - datetime.timedelta(days=1)
        profile["ExpirationDate"] = datetime.datetime.utcnow() + datetime.timedelta(days=30)
        profile_path = self.root / "approved-profile.plist"
        profile_path.write_bytes(plistlib.dumps(profile))
        configuration = self.root / "sign-args.json"
        configuration.write_text(json.dumps({key: str(value) for key, value in vars(args).items()}))
        driver = self.root / "interrupt-driver.py"
        driver.write_text('''import base64, hashlib, importlib.util, json, os, pathlib, plistlib, subprocess, sys
from types import SimpleNamespace
spec = importlib.util.spec_from_file_location("artifact", sys.argv[1])
artifact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(artifact)
root = pathlib.Path(sys.argv[2])
artifact.ROOT = root
arguments = json.loads((root / "sign-args.json").read_text())
for key in ("input", "output", "archive", "frontend"):
    if key in arguments:
        arguments[key] = pathlib.Path(arguments[key])
args = SimpleNamespace(**arguments)
profile_bytes = (root / "approved-profile.plist").read_bytes()
profile = plistlib.loads(profile_bytes)
certificate = hashlib.sha1(profile["DeveloperCertificates"][0]).hexdigest().upper()
original_run = artifact.run
def release_tool(command, capture=False):
    if command == ["/usr/bin/xcodebuild", "-version"]:
        return b"Xcode 26.1\\nBuild version 17B55"
    if command[:3] == ["/usr/bin/security", "list-keychains", "-d"] and len(command) == 4:
        return b'"/fixture/login.keychain-db"'
    if command[:3] == ["/usr/bin/security", "cms", "-D"]:
        return profile_bytes
    if command[:2] == ["/usr/bin/security", "create-keychain"]:
        pathlib.Path(command[-1]).write_bytes(b"disposable credential fixture")
    if command[:2] == ["/usr/bin/security", "find-identity"]:
        return (certificate + ' "Apple Distribution: Example (0123456789)"').encode()
    if command[:2] == ["/usr/bin/xcodebuild", "-exportArchive"]:
        code = "import os,pathlib,time;pathlib.Path(" + repr(str(root / "child-ready")) + ").write_text(str(os.getpid()));time.sleep(60)"
        return original_run([sys.executable, "-I", "-c", code], True)
    return b""
def cleanup_tool(command, **kwargs):
    if command[:2] == ["/usr/bin/security", "delete-keychain"]:
        pathlib.Path(command[-1]).unlink()
        (root / "keychain-removed").touch()
    return SimpleNamespace(returncode=0)
artifact.run = release_tool
artifact.subprocess.run = cleanup_tool
os.environ.update({"HOME": str(root / "home"), "RUNNER_TEMP": str(root), "IOS_DIST_CERT_P12": base64.b64encode(b"disposable identity fixture").decode(),
                   "IOS_DIST_CERT_PASSWORD": "fixture-password", "IOS_APP_STORE_PROFILE": base64.b64encode(b"disposable CMS fixture").decode()})
artifact.install_signal_handlers()
try:
    artifact.sign(args)
except artifact.ReleaseError:
    (root / "interrupted").touch()
''')
        original_script = Path(__file__).resolve().parent.parent / "scripts/ios-release-artifact.py"
        for interruption in (signal.SIGTERM, signal.SIGINT):
            with self.subTest(signal=interruption):
                for name in ("child-ready", "keychain-removed", "interrupted"):
                    (self.root / name).unlink(missing_ok=True)
                child = subprocess.Popen([sys.executable, "-I", str(driver), str(original_script), str(self.root)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                try:
                    deadline = time.monotonic() + 5
                    while not (self.root / "child-ready").exists() and child.poll() is None and time.monotonic() < deadline:
                        time.sleep(0.02)
                    self.assertTrue((self.root / "child-ready").exists())
                    subprocess_pid = int((self.root / "child-ready").read_text())
                    child.send_signal(interruption)
                    output, errors = child.communicate(timeout=10)
                    self.assertEqual(child.returncode, 0, output + errors)
                    with self.assertRaises(ProcessLookupError):
                        os.kill(subprocess_pid, 0)
                    self.assertTrue((self.root / "interrupted").exists())
                    self.assertTrue((self.root / "keychain-removed").exists())
                    self.assertFalse(list(self.root.glob("lolly-ios-sign-*")))
                    self.assertFalse(list((self.root / "home").rglob("*.mobileprovision")))
                finally:
                    if child.poll() is None:
                        child.kill()
                    child.communicate()
                (args.input / artifact.ARCHIVE / "Products/Applications/Lolly.app/embedded.mobileprovision").unlink()
                (args.input / artifact.ARCHIVE / "Info.plist").write_bytes((self.archive / "Info.plist").read_bytes())


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.datetime(2026, 10, 13)
        self.expected = {"bundle": "tools.example.mobile", "team": "0123456789", "version": "1.1.0"}
        self.profile = {"TeamIdentifier": ["0123456789"], "Platform": ["iOS"], "CreationDate": self.now - datetime.timedelta(days=1),
                        "ExpirationDate": self.now + datetime.timedelta(days=30), "ApplicationIdentifierPrefix": ["0123456789"],
                        "UUID": "00000000-0000-0000-0000-000000000000", "DeveloperCertificates": [b"disposable certificate fixture"],
                        "Entitlements": {"application-identifier": "0123456789.tools.example.mobile", "com.apple.developer.team-identifier": "0123456789",
                                         "get-task-allow": False, "beta-reports-active": True, "keychain-access-groups": ["0123456789.*"], "unrequested-extra-capability": True}}

    def test_profile_grants_only_the_exact_application_and_needed_entitlements(self):
        entitlements, certificates = artifact.profile_policy(self.profile, self.expected, self.now)
        self.assertEqual(entitlements["keychain-access-groups"], ["0123456789.tools.example.mobile"])
        self.assertNotIn("unrequested-extra-capability", entitlements)
        self.assertEqual(certificates, {hashlib.sha1(self.profile["DeveloperCertificates"][0]).hexdigest().upper()})

    def test_development_enterprise_expired_and_other_team_profiles_are_refused(self):
        for key, value in [("TeamIdentifier", ["9876543210"]), ("Platform", ["macOS"]), ("ProvisionedDevices", ["device"]),
                           ("ProvisionsAllDevices", True), ("ExpirationDate", self.now), ("CreationDate", self.now + datetime.timedelta(hours=1))]:
            with self.subTest(key=key):
                original = dict(self.profile)
                self.profile[key] = value
                with self.assertRaises(ValueError):
                    artifact.profile_policy(self.profile, self.expected, self.now)
                self.profile = original

    def test_wildcard_app_identity_debugging_and_wrong_groups_are_refused(self):
        for key, value in [("application-identifier", "0123456789.*"), ("get-task-allow", True), ("beta-reports-active", False), ("keychain-access-groups", ["other.*"])]:
            with self.subTest(key=key):
                original = dict(self.profile["Entitlements"])
                self.profile["Entitlements"][key] = value
                with self.assertRaises(ValueError):
                    artifact.profile_policy(self.profile, self.expected, self.now)
                self.profile["Entitlements"] = original


if __name__ == "__main__":
    unittest.main()
