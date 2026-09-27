import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('collector', SCRIPTS / 'collect_repository_licenses.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class RepositoryLicenseCollectionTests(unittest.TestCase):
    def test_recursive_reuse_and_legal_documents(self):
        for path in ['.reuse/dep5', 'sub/.reuse/dep5', 'REUSE.toml', 'sub/REUSE.toml',
                     'LICENSES/MIT.txt', 'license/third_party/boost_LICENSE.txt',
                     'src/image.png.license', 'src/file.ts.license', 'NOTICE.md',
                     'COPYRIGHT', 'docs/legal/README.md']:
            with self.subTest(path=path):
                self.assertTrue(collector.is_license_path(path))
        self.assertTrue(collector.is_license_path('LICENSE.BSD'))

    def test_source_files_are_not_selected(self):
        for path in ['src/main.ts', 'compiler/scripts/copyright.js', 'license_test.py',
                     'LICENSE.java', 'LICENSES/test.cpp', 'README.md', 'package.json']:
            with self.subTest(path=path):
                self.assertFalse(collector.is_license_path(path))

    def test_untrusted_paths_cannot_escape_snapshot(self):
        for path in ['../LICENSE', '/LICENSE', 'foo/../../NOTICE', 'foo\\..\\NOTICE']:
            with self.subTest(path=path):
                with self.assertRaises(ValueError):
                    collector.safe_relative(path)
        self.assertNotIn(':', str(collector.safe_relative('C:/LICENSE')))

    def test_network_error_does_not_become_absent_file(self):
        error = collector.error_record(collector.fetch.__globals__['SourceError'](
            {'kind': 'network_error', 'message': 'DNS lookup failed'}), 'https://example.invalid')
        self.assertEqual(error['kind'], 'network_error')
        self.assertEqual(error['url'], 'https://example.invalid')

    def test_truncated_tree_is_expanded(self):
        def request(url):
            if url.endswith('/root?recursive=1'):
                return {'truncated': True, 'tree': []}, 'a'
            if url.endswith('/root'):
                return {'truncated': False, 'tree': [{'type': 'tree', 'path': 'nested', 'sha': 'child'}]}, 'b'
            return {'truncated': False, 'tree': [{'type': 'blob', 'path': 'REUSE.toml', 'sha': 'file'}]}, 'c'
        entries, requests, errors = collector.discover_tree('owner/repo', 'root', request)
        self.assertEqual(entries[0]['path'], 'nested/REUSE.toml')
        self.assertEqual(len(requests), 3)
        self.assertEqual(errors, [])

    def test_failed_tree_is_incomplete(self):
        def request(_url):
            raise TimeoutError('timeout')
        entries, _, errors = collector.discover_tree('owner/repo', 'root', request)
        self.assertEqual(entries, [])
        self.assertEqual(errors[0]['kind'], 'network_error')

    def test_file_manifest_preserves_path_and_hash(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            record = collector.save_document(directory, '.reuse/dep5', b'Copyright: Example\n', {'url': 'https://example.invalid/dep5'})
            self.assertEqual(record['originalPath'], '.reuse/dep5')
            self.assertEqual((directory / record['savedPath']).read_bytes(), b'Copyright: Example\n')
            self.assertEqual(record['sha256'], collector.sha(b'Copyright: Example\n'))

    def test_unresolved_version_never_uses_default_branch(self):
        with patch.object(collector, 'remote_json', return_value=({'name': 'example', 'version': '1.0.0', 'repository': 'https://github.com/example/repo'}, 'hash')):
            result = collector.resolve_component({'id': 'example@1.0.0', 'ecosystem': 'npm', 'name': 'example', 'version': '1.0.0'}, {})
        self.assertIsNone(result['commit'])
        self.assertEqual(result['errors'][0]['kind'], 'repository_version_unresolved')

    def test_androidx_release_requires_correct_version_and_artifact(self):
        document = '<h3>Version 1.2.0</h3><code>androidx.test:test-*:1.2.0</code><a href="https://android.googlesource.com/platform/frameworks/support/+log/' + 'a'*40 + '..' + 'b'*40 + '/test">these commits</a><h3>Version 1.1.0</h3>'
        self.assertEqual(collector.androidx_release_commit(document, 'androidx.test:test-ktx:1.2.0')[0], 'b'*40)
        self.assertEqual(collector.androidx_release_commit(document, 'androidx.test:test-ktx:1.1.0'), (None, None))
        self.assertEqual(collector.androidx_release_commit(document, 'androidx.other:other:1.2.0'), (None, None))


if __name__ == '__main__':
    unittest.main()
