import importlib.util
import tempfile
import unittest
import sys
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "overnight.py"
spec = importlib.util.spec_from_file_location("overnight", SCRIPT)
overnight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(overnight)


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.run_dir = self.root / ".ai" / "runs" / "run"
        self.run_dir.mkdir(parents=True)
        roadmap = self.root / overnight.ROADMAP
        roadmap.parent.mkdir(parents=True, exist_ok=True)
        roadmap.write_text("# 로드맵", encoding="utf-8")
        self.root_patch = patch.object(overnight, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def test_existing_report_is_preserved(self):
        report = self.root / ".ai" / "guide" / "TASK-001.md"
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text("original", encoding="utf-8")
        with patch.object(overnight, "run_command") as run:
            result = overnight.generate_report("TASK-001", self.run_dir, 5, "history")
        self.assertEqual("기존 보고서 유지", result)
        self.assertEqual("original", report.read_text(encoding="utf-8"))
        run.assert_not_called()

    def test_success_writes_report_and_backs_up_previous(self):
        report = self.root / ".ai" / "guide" / "TASK-001.md"
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text("original", encoding="utf-8")

        def fake_run(command, logfile, timeout):
            self.assertIn(overnight.ROADMAP.as_posix(), command[-1])
            Path(command[command.index("--output-last-message") + 1]).write_text("# 새 보고서\n```mermaid\nflowchart LR\nA --> B\n```", encoding="utf-8")
            return 0

        with patch.object(overnight, "run_command", side_effect=fake_run):
            result = overnight.generate_report("TASK-001", self.run_dir, 5, "history", overwrite=True)
        self.assertIn("보고서:", result)
        self.assertIn("# 새 보고서", report.read_text(encoding="utf-8"))
        self.assertEqual("original", (self.run_dir / "TASK-001-previous-report.md").read_text(encoding="utf-8"))

    def test_failure_preserves_existing_report(self):
        report = self.root / ".ai" / "guide" / "TASK-001.md"
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text("original", encoding="utf-8")
        with patch.object(overnight, "run_command", return_value=1):
            result = overnight.generate_report("TASK-001", self.run_dir, 5, "history", overwrite=True)
        self.assertTrue(result.startswith("보고서 생성 실패"))
        self.assertEqual("original", report.read_text(encoding="utf-8"))

    def test_empty_output_is_failure(self):
        with patch.object(overnight, "run_command", return_value=0):
            result = overnight.generate_report("TASK-001", self.run_dir, 5, "history")
        self.assertTrue(result.startswith("보고서 생성 실패"))

    def test_missing_diagram_is_failure(self):
        def fake_run(command, logfile, timeout):
            Path(command[command.index("--output-last-message") + 1]).write_text("# 보고서", encoding="utf-8")
            return 0

        with patch.object(overnight, "run_command", side_effect=fake_run):
            result = overnight.generate_report("TASK-001", self.run_dir, 5, "history")
        self.assertIn("Mermaid 다이어그램 없음", result)

    def test_reports_only_writes_progress_and_summary_under_ai(self):
        (self.root / "PLAN.md").write_text("# Plan\n\n## TASK-001\n", encoding="utf-8")
        with patch.object(sys, "argv", ["overnight.py", "--reports-only", "--task", "TASK-001"]), \
             patch.object(overnight.shutil, "which", return_value="/usr/bin/codex"), \
             patch.object(overnight, "generate_report", return_value="보고서: .ai/guide/TASK-001.md"):
            self.assertEqual(0, overnight.main())
        self.assertIn("TASK-001", (self.root / ".ai" / "PROGRESS.md").read_text(encoding="utf-8"))
        self.assertIn("TASK-001", (self.root / ".ai" / "REPORT.md").read_text(encoding="utf-8"))
        self.assertFalse((self.root / "PROGRESS.md").exists())
        self.assertFalse((self.root / "REPORT.md").exists())

    def test_missing_roadmap_stops_execution_before_codex(self):
        (self.root / "PLAN.md").write_text("# Plan\n\n## TASK-001\n", encoding="utf-8")
        (self.root / overnight.ROADMAP).unlink()
        with patch.object(sys, "argv", ["overnight.py", "--task", "TASK-001"]), \
             patch.object(overnight, "run_command") as run:
            self.assertEqual(1, overnight.main())
        run.assert_not_called()

    def test_task_prompt_references_roadmap(self):
        (self.root / "PLAN.md").write_text("# Plan\n\n## TASK-001\n", encoding="utf-8")
        commands = []

        def fake_run(command, logfile, timeout):
            commands.append(command)
            return 0

        with patch.object(sys, "argv", ["overnight.py", "--task", "TASK-001"]), \
             patch.object(overnight.shutil, "which", return_value="/usr/bin/codex"), \
             patch.object(overnight, "run_command", side_effect=fake_run), \
             patch.object(overnight, "generate_report", return_value="보고서 생성 완료"):
            self.assertEqual(0, overnight.main())
        self.assertIn(overnight.ROADMAP.as_posix(), commands[0][-1])


if __name__ == "__main__":
    unittest.main()
