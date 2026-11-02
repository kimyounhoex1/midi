#!/usr/bin/env python3
"""Extract ERROR entries and their timestamps from text log files."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ERROR_MARKER = re.compile(r"ERROR", re.IGNORECASE)
TIMESTAMP_PATTERNS = (
    re.compile(
        r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"
        r"(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?"
    ),
    re.compile(r"\d{4}/\d{2}/\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?"),
    re.compile(r"\d{2}:\d{2}:\d{2}(?:[.,]\d+)?"),
)


@dataclass(frozen=True)
class ErrorLogEntry:
    """One matching log line and its source location."""

    path: Path
    line_number: int
    timestamp: str
    message: str


def extract_timestamp(line: str) -> str | None:
    """Return the first supported timestamp in *line*."""
    for pattern in TIMESTAMP_PATTERNS:
        match = pattern.search(line)
        if match:
            return match.group(0)
    return None


def extract_error_logs(paths: Iterable[Path | str]) -> list[ErrorLogEntry]:
    """Return timestamped lines containing ERROR from the supplied log files.

    ERROR matching is case-insensitive. A matching line without a recognizable
    timestamp is still returned with an empty timestamp so no error is hidden.
    """
    entries: list[ErrorLogEntry] = []
    for path_value in paths:
        path = Path(path_value)
        with path.open(encoding="utf-8", errors="replace") as stream:
            for line_number, raw_line in enumerate(stream, start=1):
                message = raw_line.rstrip("\r\n")
                if not ERROR_MARKER.search(message):
                    continue
                entries.append(
                    ErrorLogEntry(
                        path=path,
                        line_number=line_number,
                        timestamp=extract_timestamp(message) or "",
                        message=message,
                    )
                )
    return entries


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="로그 파일에서 ERROR 행과 발생 시간을 추출합니다."
    )
    parser.add_argument("logs", nargs="+", type=Path, help="검색할 로그 파일")
    args = parser.parse_args(argv)

    try:
        entries = extract_error_logs(args.logs)
    except OSError as error:
        parser.error(str(error))

    for entry in entries:
        timestamp = entry.timestamp or "시간 없음"
        print(f"{entry.path}:{entry.line_number}\t{timestamp}\t{entry.message}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
