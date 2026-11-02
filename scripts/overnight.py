#!/usr/bin/env python3
"""Run explicitly planned Codex tasks sequentially and verify core tests."""

import argparse
import datetime as dt
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASK_HEADER = re.compile(r"^##\s+(TASK-\d+)\s*$", re.MULTILINE)
MAX_ATTEMPTS = 3
TEST_COMMAND = ["npm", "run", "test:core"]


def planned_tasks(plan):
    # Examples inside fenced code blocks are documentation, not tasks.
    lines = []
    in_fence = False
    for line in plan.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
        elif not in_fence:
            lines.append(line)
    return TASK_HEADER.findall("\n".join(lines))


def append(path, message):
    with path.open("a", encoding="utf-8") as stream:
        stream.write(message + "\n")


def run_command(command, logfile, timeout):
    with logfile.open("a", encoding="utf-8") as stream:
        stream.write("\n$ " + " ".join(command[:4]) + "\n")
        stream.flush()
        try:
            result = subprocess.run(command, cwd=ROOT, stdout=stream,
                                    stderr=subprocess.STDOUT, timeout=timeout)
            return result.returncode
        except subprocess.TimeoutExpired:
            stream.write("\n시간 제한 초과\n")
            return 124
        except OSError as error:
            stream.write(f"\n실행 오류: {error}\n")
            return 127


def main():
    parser = argparse.ArgumentParser(description="PLAN.md의 작업을 순차 실행합니다.")
    parser.add_argument("--task", action="append", help="실행할 작업 ID (여러 번 지정 가능)")
    parser.add_argument("--timeout", type=int, default=3600, help="명령별 제한 시간(초)")
    parser.add_argument("--dry-run", action="store_true", help="실행할 작업만 표시")
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout은 양수여야 합니다")

    tasks = planned_tasks((ROOT / "PLAN.md").read_text(encoding="utf-8"))
    if len(tasks) != len(set(tasks)):
        parser.error("PLAN.md에 중복된 작업 ID가 있습니다")
    if args.task:
        unknown = set(args.task) - set(tasks)
        if unknown:
            parser.error("계획에 없는 작업: " + ", ".join(sorted(unknown)))
        tasks = [task for task in tasks if task in args.task]
    if not tasks:
        print("PLAN.md에 실행할 작업이 없습니다.")
        return 0
    print("작업 순서: " + ", ".join(tasks), flush=True)
    if args.dry_run:
        return 0
    if not shutil.which("codex") or not shutil.which("npm"):
        print("codex와 npm이 PATH에 필요합니다.", file=sys.stderr)
        return 1

    run_id = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    run_dir = ROOT / ".ai" / "runs" / run_id
    run_dir.mkdir(parents=True)
    append(ROOT / "PROGRESS.md", f"\n## 실행 {run_id}")
    results = []
    for task in tasks:
        logfile = run_dir / f"{task}.log"
        success = False
        for attempt in range(1, MAX_ATTEMPTS + 1):
            print(f"{task}: 시도 {attempt}/{MAX_ATTEMPTS}", flush=True)
            prompt = (f"AGENTS.md와 PLAN.md를 읽고 {task}만 수행하세요. "
                      "기존 사용자 변경을 보존하고, 구현 및 관련 테스트를 수행하세요. "
                      "실패 또는 미완료 사항을 명시하고 push와 배포는 하지 마세요. "
                      f"이전 실행과 테스트 실패 내용은 {logfile.relative_to(ROOT)}에서 확인하세요.")
            code = run_command(["codex", "exec", "--sandbox", "workspace-write", prompt], logfile, args.timeout)
            test_code = run_command(TEST_COMMAND, logfile, args.timeout) if code == 0 else None
            append(ROOT / "PROGRESS.md", f"- {task} 시도 {attempt}: Codex 종료 코드 {code}, core 테스트 {test_code if test_code is not None else '미실행'}")
            if code == 0 and test_code == 0:
                success = True
                break
        results.append((task, success))
        if not success:
            break
    append(ROOT / "REPORT.md", f"\n## 실행 {run_id}\n- 로그: `{run_dir.relative_to(ROOT)}/`\n" +
           "\n".join(f"- {task}: {'CLI 및 core 테스트 통과, 결과 검토 필요' if ok else '실패 또는 미완료'}" for task, ok in results))
    return 0 if all(ok for _, ok in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
