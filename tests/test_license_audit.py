import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import zipfile

spec = importlib.util.spec_from_file_location("audit", Path(__file__).resolve().parents[1] / "scripts/audit_third_party_licenses.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class LicenseAuditTests(unittest.TestCase):
    def test_network_failure_remains_explicit(self):
        component = {"sources": []}
        with patch.object(audit, "fetch", side_effect=urllib.error.URLError("DNS failure")):
            audit.source(component, "https://example.invalid/license", None, "", lambda data: data)
        self.assertEqual(component["sources"][0]["error"]["kind"], "network_error")
        self.assertEqual(component["sources"][0]["status"], "failed")

    def test_404_is_missing_source_not_network_failure(self):
        error = urllib.error.HTTPError("https://example.invalid", 404, "Not Found", {}, None)
        self.assertEqual(audit.failure(error)["kind"], "source_unavailable")
        error.close()

    def test_download_helper_error_preserves_network_reason(self):
        error = audit.SourceError({"kind": "network_error", "message": "TLS certificate verification failed"})
        self.assertEqual(audit.failure(error)["message"], "TLS certificate verification failed")

    def test_minified_source_without_copyright(self):
        with tempfile.TemporaryDirectory() as temporary:
            component = {"findings": []}
            audit.inspect_files([("bundle.js", b"x" * 1000000)], "test", component, Path(temporary), "")
            self.assertEqual(component["findings"], [])

    def test_nested_notice_and_path_traversal_are_only_read(self):
        inner = io.BytesIO()
        with zipfile.ZipFile(inner, "w") as archive:
            archive.writestr("../../NOTICE", "Copyright 2026 Example")
        outer = io.BytesIO()
        with zipfile.ZipFile(outer, "w") as archive:
            archive.writestr("classes.jar", inner.getvalue())
        files = list(audit.archive_files(outer.getvalue(), "root"))
        self.assertEqual(files[0][1], b"Copyright 2026 Example")
        with tempfile.TemporaryDirectory() as temporary:
            component = {"findings": []}
            audit.inspect_files(files, "test", component, Path(temporary), "")
            self.assertFalse(component["findings"][0]["textPresentInCurrentNotices"])
            self.assertTrue((Path(temporary) / component["findings"][0]["savedFile"]).is_file())

    def test_existing_notice_accepts_whitespace_variation(self):
        with tempfile.TemporaryDirectory() as temporary:
            component = {"findings": []}
            audit.inspect_files([("LICENSE", b"Copyright 2026\r\nExample")], "test", component, Path(temporary), "Copyright 2026 Example")
            self.assertTrue(component["findings"][0]["textPresentInCurrentNotices"])


if __name__ == "__main__":
    unittest.main()
