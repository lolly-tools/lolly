# SPDX-License-Identifier: MPL-2.0
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).resolve().parents[1] / 'shells/tauri-desktop/release/lolli.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class Store:
    def __init__(self):
        self.writes = []

    def put_object(self, **kwargs):
        self.writes.append(kwargs)

    def get_object(self, **kwargs):
        return {'Body': io.BytesIO(b'previous pointer')}


class PublisherTests(unittest.TestCase):
    def test_metadata_and_immutable_precondition(self):
        with tempfile.NamedTemporaryFile() as f:
            store = Store()
            publisher.upload(store, f.name, 'releases/1.2.3/linux/x86_64/app.sig')
            row = store.writes[0]
            self.assertEqual(row['IfNoneMatch'], '*')
            self.assertIn('immutable', row['CacheControl'])
            self.assertEqual(row['ContentType'], 'text/plain; charset=utf-8')
            self.assertEqual(publisher.ctype('updates/linux/x86_64/latest.json'), 'application/json; charset=utf-8')
            self.assertIn('must-revalidate', publisher.cache_policy('updates/linux/x86_64/latest.json'))

    def test_pointer_cannot_be_uploaded_or_aliased_without_verification(self):
        with tempfile.NamedTemporaryFile() as f:
            store = Store()
            with self.assertRaises(ValueError):
                publisher.cmd_put(store, [f.name, 'updates/linux/x86_64/latest.json'])
            with self.assertRaises(ValueError):
                publisher.cmd_alias(store, ['updates/linux/x86_64/latest.json', 'other'])
            with self.assertRaises(ValueError):
                publisher.cmd_alias(store, ['releases/1.2.3/app', 'other'])
            for key in ['releases/1.2.3/app', 'updates/linux/x86_64/latest.json']:
                with self.assertRaises(ValueError):
                    publisher.cmd_rm(store, [key])
            self.assertEqual(store.writes, [])

    def test_interrupted_promotion_can_resume_only_with_identical_bytes(self):
        class Existing(Store):
            def put_object(self, **kwargs):
                error = ValueError('exists')
                error.response = {'ResponseMetadata': {'HTTPStatusCode': 412}}
                raise error
        with tempfile.NamedTemporaryFile() as f:
            f.write(b'previous pointer')
            f.flush()
            publisher.upload(Existing(), f.name, 'releases/1.2.3/app')
            f.write(b'changed')
            f.flush()
            with self.assertRaises(ValueError):
                publisher.upload(Existing(), f.name, 'releases/1.2.3/app')

    def promote(self, hashes, validate=True):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / 'app.AppImage'
            artifact.write_bytes(b'app')
            Path(str(artifact) + '.sig').write_text('signature')
            key = 'updates/linux/x86_64/latest.json'
            plan = {'version': '1.2.3', 'artifacts': [{'path': str(artifact), 'key': 'releases/1.2.3/linux/x86_64/app.AppImage',
                    'url': 'https://lolli.li/releases/1.2.3/linux/x86_64/app.AppImage', 'sha256': 'expected'}], 'manifests': {key: {'version': '1.2.3'}}}
            file = root / 'promotion.json'
            file.write_text(json.dumps(plan))
            store = Store()
            with patch.object(publisher, 'run', side_effect=None if validate else ValueError('trust refused')), patch.object(publisher, 'public_hash', side_effect=hashes):
                if validate and hashes[0] == 'expected':
                    publisher.cmd_promote(store, [str(file)])
                else:
                    with self.assertRaises(ValueError):
                        publisher.cmd_promote(store, [str(file)])
            return store.writes

    def test_failed_validation_moves_no_bytes(self):
        self.assertEqual(self.promote([], False), [])

    def test_failed_public_artifact_leaves_pointer_unchanged(self):
        writes = self.promote(['wrong'])
        self.assertTrue(all(row['Key'].startswith('releases/') for row in writes))

    def test_promotion_saves_previous_pointer_and_promotes_last(self):
        signature = publisher.hashlib.sha256(b'signature').hexdigest()
        pointer = publisher.hashlib.sha256((json.dumps({'version': '1.2.3'}, indent=2) + '\n').encode()).hexdigest()
        writes = self.promote(['expected', signature, pointer])
        self.assertIn('/previous/', writes[-2]['Key'])
        self.assertEqual(writes[-1]['Key'], 'updates/linux/x86_64/latest.json')
        self.assertEqual(writes[-2]['IfNoneMatch'], '*')


if __name__ == '__main__':
    unittest.main()
