#!/usr/bin/env python3
"""Generate a Markdown analysis report from ERROR log entries."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from extract_error_logs import ErrorLogEntry, extract_error_logs

DEFAULT_OUTPUT = Path(".ai/REPORT.md")


def _table_text(value: object) -> str:
    """Escape a value for a single Markdown table cell."""
    return str(value).replace("\\", "\\\\").replace("|", "\\|").replace("\n", " ")


def render_error_report(entries: Iterable[ErrorLogEntry]) -> str:
    """Return a Markdown report containing the errors and a short analysis."""
    error_entries = list(entries)
    timestamped = sum(bool(entry.timestamp) for entry in error_entries)
    missing_times = len(error_entries) - timestamped

    lines = [
        "# 오류 로그 분석 보고서",
        "",
        "## 오류 로그 목록",
        "",
    ]
    if error_entries:
        lines.extend(
            [
                "| 발생 시간 | 위치 | 오류 로그 |",
                "| --- | --- | --- |",
            ]
        )
        for entry in error_entries:
            occurred_at = entry.timestamp or "시간 없음"
            location = f"{entry.path}:{entry.line_number}"
            lines.append(
                f"| {_table_text(occurred_at)} | {_table_text(location)} | "
                f"{_table_text(entry.message)} |"
            )
    else:
        lines.append("ERROR 문자열이 포함된 로그가 없습니다.")

    lines.extend(
        [
            "",
            "## 분석 결과",
            "",
            f"- 오류 로그: {len(error_entries)}건",
            f"- 발생 시간 확인: {timestamped}건",
            f"- 발생 시간 누락: {missing_times}건",
            "",
        ]
    )
    return "\n".join(lines)


def write_error_report(
    log_paths: Iterable[Path | str], output_path: Path | str = DEFAULT_OUTPUT
) -> Path:
    """Extract errors from *log_paths* and save their Markdown report."""
    output = Path(output_path)
    if output == DEFAULT_OUTPUT:
        output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        render_error_report(extract_error_logs(log_paths)), encoding="utf-8"
    )
    return output


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="ERROR 로그와 발생 시간을 Markdown 리포트로 저장합니다."
    )
    parser.add_argument("logs", nargs="+", type=Path, help="분석할 로그 파일")
    parser.add_argument(
        "-o", "--output", type=Path, default=DEFAULT_OUTPUT, help="출력 파일 (기본: .ai/REPORT.md, 기존 내용 덮어쓰기)"
    )
    args = parser.parse_args(argv)

    try:
        output = write_error_report(args.logs, args.output)
    except OSError as error:
        parser.error(str(error))
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
