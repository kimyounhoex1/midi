import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from extract_error_logs import ErrorLogEntry
from generate_error_report import render_error_report, write_error_report


class GenerateErrorReportTests(unittest.TestCase):
    def test_report_lists_errors_times_and_analysis(self):
        entries = [
            ErrorLogEntry(
                path=Path("application.log"),
                line_number=7,
                timestamp="2026-11-01 19:05:06",
                message="2026-11-01 19:05:06 ERROR connection failed",
            ),
            ErrorLogEntry(
                path=Path("worker.log"),
                line_number=3,
                timestamp="",
                message="ERROR retry | failed",
            ),
        ]

        report = render_error_report(entries)

        self.assertIn("## 오류 로그 목록", report)
        self.assertIn("2026-11-01 19:05:06", report)
        self.assertIn("worker.log:3", report)
        self.assertIn("ERROR retry \\| failed", report)
        self.assertIn("- 오류 로그: 2건", report)
        self.assertIn("- 발생 시간 누락: 1건", report)

    def test_empty_report_records_zero_results(self):
        report = render_error_report([])

        self.assertIn("ERROR 문자열이 포함된 로그가 없습니다.", report)
        self.assertIn("- 오류 로그: 0건", report)

    def test_write_report_extracts_log_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            log = directory_path / "application.log"
            output = directory_path / "REPORT.md"
            log.write_text("[19:05:06] ERROR stopped\n", encoding="utf-8")

            written = write_error_report([log], output)
            report = output.read_text(encoding="utf-8")

        self.assertEqual(output, written)
        self.assertIn("19:05:06", report)
        self.assertIn("ERROR stopped", report)

    def test_cli_creates_requested_report(self):
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            log = directory_path / "application.log"
            output = directory_path / "result.md"
            log.write_text("2026-11-01 19:05:06 ERROR stopped\n", encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts" / "generate_error_report.py"),
                    str(log),
                    "--output",
                    str(output),
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            report = output.read_text(encoding="utf-8")

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(f"{output}\n", result.stdout)
        self.assertIn("오류 로그 분석 보고서", report)


if __name__ == "__main__":
    unittest.main()
