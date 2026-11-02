import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from extract_error_logs import extract_error_logs, extract_timestamp


class ExtractErrorLogsTests(unittest.TestCase):
    def test_extracts_only_error_lines_with_occurrence_times(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "application.log"
            log.write_text(
                "2026-11-01 19:00:00 INFO ready\n"
                "2026-11-01T19:01:02.345+09:00 ERROR connection failed\n"
                "2026/11/01 19:02:03 error retry failed\n",
                encoding="utf-8",
            )

            entries = extract_error_logs([log])

        self.assertEqual(2, len(entries))
        self.assertEqual("2026-11-01T19:01:02.345+09:00", entries[0].timestamp)
        self.assertEqual("2026/11/01 19:02:03", entries[1].timestamp)
        self.assertEqual([2, 3], [entry.line_number for entry in entries])

    def test_keeps_error_line_when_timestamp_is_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "application.log"
            log.write_text("ERROR no timestamp\n", encoding="utf-8")
            entry = extract_error_logs([log])[0]

        self.assertEqual("", entry.timestamp)
        self.assertEqual("ERROR no timestamp", entry.message)

    def test_extracts_time_only_format(self):
        self.assertEqual("19:04:05,123", extract_timestamp("[19:04:05,123] ERROR stopped"))

    def test_cli_returns_search_results(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "application.log"
            log.write_text("[2026-11-01 19:05:06] ERROR stopped\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "extract_error_logs.py"), str(log)],
                check=False,
                capture_output=True,
                text=True,
            )

        self.assertEqual(0, result.returncode)
        self.assertIn("2026-11-01 19:05:06", result.stdout)
        self.assertIn("ERROR stopped", result.stdout)


if __name__ == "__main__":
    unittest.main()
