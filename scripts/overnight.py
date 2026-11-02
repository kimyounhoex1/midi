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
ROADMAP = Path(".ai/guide/midi-sequencer-roadmap.md")


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


def generate_report(task, run_dir, timeout, context, overwrite=False):
    report = ROOT / ".ai" / "guide" / f"{task}.md"
    if report.exists() and not overwrite:
        return "기존 보고서 유지"

    candidate = run_dir / f"{task}-report.md"
    logfile = run_dir / f"{task}-report.log"
    prompt = (
        f"PLAN.md의 {task}에 대한 한국어 Markdown 보고서만 작성하세요. "
        f"{ROADMAP.as_posix()}에서 관련 장기 방향을 참고하되 현재 코드와 로그를 기준으로 완료 여부를 판단하세요. "
        "코드와 .ai/runs/ 로그, .ai/PROGRESS.md를 읽어 사실을 확인하세요. "
        "파일을 수정하거나 명령을 실행하지 말고 최종 답변으로 보고서만 출력하세요. "
        "주요 기능, 관련 파일, 설계 순서와 주요 로직 흐름을 설명하고 "
        "Mermaid flowchart 다이어그램을 포함하세요. 테스트 명령과 실제 결과, "
        "직접 확인 방법, 미구현 및 미검증 항목을 명시하세요. "
        "과거 로그와 현재 코드를 구분하고 근거가 없으면 추측하지 마세요. "
        f"이번 실행 정보: {context}"
    )
    command = ["codex", "exec", "--sandbox", "read-only", "--output-last-message", str(candidate), prompt]
    code = run_command(command, logfile, timeout)
    if code != 0 or not candidate.exists() or not candidate.read_text(encoding="utf-8").strip():
        return f"보고서 생성 실패 (종료 코드 {code}, 로그: {logfile.relative_to(ROOT)})"
    if "```mermaid" not in candidate.read_text(encoding="utf-8").lower():
        return f"보고서 생성 실패 (Mermaid 다이어그램 없음, 로그: {logfile.relative_to(ROOT)})"
    report.parent.mkdir(parents=True, exist_ok=True)
    if report.exists():
        shutil.copy2(report, run_dir / f"{task}-previous-report.md")
    candidate.replace(report)
    return f"보고서: {report.relative_to(ROOT)}"


def main():
    parser = argparse.ArgumentParser(description="PLAN.md의 작업을 순차 실행합니다.")
    parser.add_argument("--task", action="append", help="실행할 작업 ID (여러 번 지정 가능)")
    parser.add_argument("--timeout", type=int, default=3600, help="명령별 제한 시간(초)")
    parser.add_argument("--dry-run", action="store_true", help="실행할 작업만 표시")
    parser.add_argument("--reports-only", action="store_true", help="작업을 재실행하지 않고 기존 코드와 로그로 보고서 생성")
    parser.add_argument("--overwrite-reports", action="store_true", help="기존 작업 보고서 갱신 (이전 파일은 실행 로그에 보관)")
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
    if not (ROOT / ROADMAP).is_file():
        print(f"프로젝트 로드맵을 찾을 수 없습니다: {ROADMAP}", file=sys.stderr)
        return 1
    if not shutil.which("codex") or (not args.reports_only and not shutil.which("npm")):
        print("codex와 (작업 실행 시) npm이 PATH에 필요합니다.", file=sys.stderr)
        return 1

    run_id = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    run_dir = ROOT / ".ai" / "runs" / run_id
    run_dir.mkdir(parents=True)
    append(ROOT / ".ai" / "PROGRESS.md", f"\n## 실행 {run_id}")
    results = []
    for task in tasks:
        if args.reports_only:
            status = generate_report(task, run_dir, args.timeout, "이전 작업 분석; 현재 실행에서는 테스트하지 않음", args.overwrite_reports)
            print(f"{task}: {status}", flush=True)
            append(ROOT / ".ai" / "PROGRESS.md", f"- {task}: {status}")
            results.append((task, not status.startswith("보고서 생성 실패")))
            continue
        logfile = run_dir / f"{task}.log"
        success = False
        for attempt in range(1, MAX_ATTEMPTS + 1):
            print(f"{task}: 시도 {attempt}/{MAX_ATTEMPTS}", flush=True)
            prompt = (f"AGENTS.md와 PLAN.md를 읽고 {task}만 수행하세요. "
                      f"{ROADMAP.as_posix()}를 읽고 관련 장기 방향을 참고하되 현재 작업 범위와 사용자 요청을 우선하세요. "
                      "기존 사용자 변경을 보존하고, 구현 및 관련 테스트를 수행하세요. "
                      "실패 또는 미완료 사항을 명시하고 push와 배포는 하지 마세요. "
                      f"이전 실행과 테스트 실패 내용은 {logfile.relative_to(ROOT)}에서 확인하세요.")
            code = run_command(["codex", "exec", "--sandbox", "workspace-write", prompt], logfile, args.timeout)
            test_code = run_command(TEST_COMMAND, logfile, args.timeout) if code == 0 else None
            append(ROOT / ".ai" / "PROGRESS.md", f"- {task} 시도 {attempt}: Codex 종료 코드 {code}, core 테스트 {test_code if test_code is not None else '미실행'}")
            if code == 0 and test_code == 0:
                success = True
                break
        context = f"Codex 종료 코드 {code}, core 테스트 종료 코드 {test_code if test_code is not None else '미실행'}, 작업 로그 {logfile.relative_to(ROOT)}"
        report_status = generate_report(task, run_dir, args.timeout, context, overwrite=True)
        print(f"{task}: {report_status}", flush=True)
        append(ROOT / ".ai" / "PROGRESS.md", f"- {task}: {report_status}")
        report_ok = not report_status.startswith("보고서 생성 실패")
        results.append((task, success and report_ok))
        if not success or not report_ok:
            break
    append(ROOT / ".ai" / "REPORT.md", f"\n## 실행 {run_id}\n- 로그: `{run_dir.relative_to(ROOT)}/`\n" +
           "\n".join(f"- {task}: {'보고서 생성 완료' if args.reports_only and ok else 'CLI 및 core 테스트 통과, 보고서 생성 완료, 결과 검토 필요' if ok else '실패 또는 미완료'}" for task, ok in results))
    return 0 if all(ok for _, ok in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
