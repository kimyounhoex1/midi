# JUCE MIDI Instrument API

피아노, 드럼, 기타 샘플 기반 MIDI 엔진을 C++로 만들고, 같은 엔진을 데스크톱 JUCE 앱과 웹 WASM API에서 함께 쓰기 위한 초기 프로젝트입니다.

## 구조

- `src/core`: 순수 C++ MIDI/샘플 재생 엔진
- `src/app`: JUCE 데스크톱 앱
- `src/wasm`: 브라우저에서 호출할 C export API
- `web`: WASM을 호출하는 JavaScript API와 예제 페이지
- `assets/samples`: 교체 가능한 WAV 샘플 위치
- `tests/core`: C++ 공용 엔진 테스트. 다른 영역의 테스트는 `tests/app`, `tests/wasm`, `tests/web`에 배치
- `scripts`: 개발 및 자동화 스크립트
- `AGENTS.md`: Codex 작업 및 파일 배치 지침
- `PLAN.md`: AI에 맡길 작업 계획
- `.ai/PROGRESS.md`, `.ai/REPORT.md`: 자동화 진행 기록과 전체 결과 (Git 제외)
- `.ai/guide`: 로컬 학습 문서와 작업별 보고서. `.ai/runs`: 자동 실행 로그 (Git 제외)
- `.ai/guide/midi-sequencer-roadmap.md`: MIDI 시퀀서 장기 기능 명세와 개발 단계 (Git 제외)
- `.vscode`: 로컬 VS Code 설정 (Git 제외)
- `build/core`, `build/native`, `build/wasm`: 환경별 빌드 산출물 (Git 제외)
- `.local/legacy-builds`: 이전 빌드 폴더 보관 위치 (Git 제외)

## Codex 작업 자동화

이 절의 명령은 프로젝트 루트에서 실행한다. Python 3, Node.js, npm, 로그인된 Codex CLI와 CMake/C++ 컴파일러가 필요하다. Python 가상환경이나 별도 Python 패키지는 필요 없다. Codex 실행에는 네트워크와 계정 사용량이 필요하다.

### `overnight.py`: 계획된 작업 실행

`scripts/overnight.py`는 `PLAN.md`의 작업을 순서대로 Codex에 맡기고, core 테스트와 작업별 보고서 생성을 수행한다.

작업과 보고서 작성 시 `.ai/guide/midi-sequencer-roadmap.md`를 참고한다. 매 실행에서 현재 파일을 읽도록 요청하므로 로드맵을 수정하면 다음 실행에 반영된다. 이 파일은 Git에서 제외되며, 파일이 없으면 실제 실행을 중단한다. 로드맵은 장기 방향이고 실제 실행 범위는 `PLAN.md`의 선택된 작업이다.

1. `PLAN.md`에 `## TASK-001` 형식으로 작업과 완료 조건을 작성한다.
2. `python3 scripts/overnight.py --dry-run`으로 실행할 작업을 확인한다.
3. `python3 scripts/overnight.py --task TASK-001`로 첫 작업만 실행한다. `--task`를 생략하면 계획된 작업을 순서대로 실행한다.
4. `.ai/PROGRESS.md`, `.ai/REPORT.md`, `.ai/runs/` 로그와 Git diff를 확인한다.

예를 들어 `PLAN.md`의 코드 블록 밖에 다음과 같이 작성한다. 제목은 반드시 `## TASK-숫자` 형식이어야 한다.

```markdown
## TASK-009

목표: 구현할 기능을 작성한다.

요구사항:
- 변경할 동작을 구체적으로 작성한다.

완료 조건:
- 확인할 테스트와 예상 결과를 작성한다.
```

실행 전 대상만 확인한다. `--dry-run`은 Codex를 실행하거나 파일을 변경하지 않는다.

```sh
python3 scripts/overnight.py --task TASK-009 --dry-run
```

작업 하나 또는 여러 개를 선택해 실행한다. 여러 작업은 옵션을 나열한 순서가 아니라 `PLAN.md`에 작성된 순서대로 실행된다.

```sh
python3 scripts/overnight.py --task TASK-009
python3 scripts/overnight.py --task TASK-009 --task TASK-010
```

`--task`를 생략하면 완료 여부와 관계없이 계획에 있는 모든 작업을 다시 실행한다.

```sh
python3 scripts/overnight.py
```

각 작업이 종료되면 `.ai/guide/TASK-001.md`와 같은 개별 보고서가 생성된다. 보고서에는 주요 기능, 설계와 로직 흐름 다이어그램, 테스트 결과와 미검증 사항이 담긴다. 기존 보고서는 갱신 전 실행 로그 폴더에 보관된다.

이전에 수행한 작업을 다시 개발하지 않고 현재 코드와 로그로 보고서만 작성하려면:

```sh
python3 scripts/overnight.py --reports-only --task TASK-001 --task TASK-002
```

`--task`를 생략하면 계획의 모든 작업을 대상으로 한다. 기존 보고서는 기본적으로 유지하며, 다시 생성하려면 `--overwrite-reports`를 추가한다. 과거 코드의 정확한 상태는 현재 코드와 다를 수 있으므로 보고서의 근거와 미검증 사항을 확인한다.

```sh
python3 scripts/overnight.py --reports-only --task TASK-001 --overwrite-reports
```

주요 옵션:

| 옵션 | 설명 |
| --- | --- |
| `--task TASK-001` | 대상 작업을 지정한다. 여러 번 사용할 수 있다. |
| `--dry-run` | 실행할 작업 목록만 출력한다. |
| `--timeout 3600` | Codex 실행, core 테스트, 보고서 생성 각각의 제한 시간을 초 단위로 지정한다. 기본값은 3600초다. |
| `--reports-only` | 개발 작업을 다시 실행하지 않고 기존 코드와 로그로 보고서를 만든다. 이 모드에서는 테스트를 실행하지 않는다. |
| `--overwrite-reports` | 보고서 전용 모드에서 기존 보고서를 갱신한다. 갱신 전 보고서는 해당 실행의 로그 폴더에 보관된다. |

작업별 실행 결과는 `.ai/runs/<실행 ID>/TASK-001.log`, 보고서 생성 과정은 같은 폴더의 `TASK-001-report.log`에서 볼 수 있다. 최종 작업 보고서는 `.ai/guide/TASK-001.md`에 저장된다. `.ai/`는 Git에서 제외된다.

각 작업은 최대 세 번 실행하며 Codex 실행 후 `npm run test:core`를 별도로 검증한다. core 테스트 통과만으로 모든 완료 조건이 충족되는 것은 아니므로 결과를 검토하고 작업별 필요한 추가 테스트를 확인한다. 실패하면 다음 작업으로 넘어가지 않는다. 작업을 다시 실행하면 완료된 작업도 다시 실행되므로 계획이나 `--task`를 확인한다.

macOS에서 실행 중 유휴 잠자기를 방지하려면 `caffeinate -i python3 scripts/overnight.py`를 사용한다. 터미널 종료 후에도 유지하려면 별도 `tmux` 세션에서 실행할 수 있다. 노트북 덮개를 닫거나 시스템을 종료하면 중단될 수 있다.

### `extract_error_logs.py`: 오류 로그 추출

입력 파일에서 대소문자 구분 없이 `ERROR`가 포함된 줄을 찾아 파일 경로, 줄 번호, 시간과 원문을 터미널에 출력한다. 인식할 수 있는 시간이 없으면 `시간 없음`으로 표시한다. `ERROR` 문자열 검색이므로 로그 수준을 별도로 판별하지는 않는다.

```sh
python3 scripts/extract_error_logs.py .ai/runs/<실행-ID>/TASK-001.log
```

`<실행-ID>`는 실제 폴더명으로 바꾼다. 여러 로그를 한 번에 지정할 수도 있다.

```sh
python3 scripts/extract_error_logs.py 경로/첫번째.log 경로/두번째.log
```

### `generate_error_report.py`: 오류 분석 문서 생성

로그에서 추출한 오류와 시간을 Markdown 표로 정리하고, 오류 건수와 시간 유무를 집계한다. `--output`으로 저장할 파일을 지정한다.

```sh
python3 scripts/generate_error_report.py .ai/runs/<실행-ID>/TASK-001.log --output /tmp/midi-error-report.md
cat /tmp/midi-error-report.md
```

여러 입력 파일도 지정할 수 있다. **`--output`을 생략하면 현재 작업 디렉토리의 `.ai/REPORT.md`를 덮어쓰므로**, 기존 자동화 기록을 보존하려면 별도 경로를 지정한다. 프로젝트 루트에서 실행하면 자동화 전체 결과 파일을 덮어쓰게 된다.

### Python 스크립트 도움말과 테스트

```sh
python3 scripts/overnight.py --help
python3 scripts/extract_error_logs.py --help
python3 scripts/generate_error_report.py --help
python3 -m unittest discover -s tests/automation -v
```

자동화 스크립트의 core 테스트 통과와 별도로 웹 기능은 `npm run test:web`, 실제 소리와 화면은 브라우저에서 확인한다.

## 샘플 파일

샘플 파일이 없어도 기본 fallback 소리가 납니다. 실제 샘플을 쓰려면 아래처럼 16-bit PCM WAV 파일을 넣으세요.

- `assets/samples/piano/piano_60.wav`
- `assets/samples/drums/kick_36.wav`
- `assets/samples/drums/snare_38.wav`
- `assets/samples/guitar/guitar_55.wav`

파일명 안의 숫자를 MIDI root note로 사용합니다.

## Core 테스트

```sh
npm run test:core
```

## 데스크톱 앱 빌드

처음 빌드할 때 JUCE를 GitHub에서 내려받습니다. 네이티브 빌드는 `build/native`를 사용합니다.

```sh
cmake -S . -B build/native
cmake --build build/native --target MidiInstrumentApp
```

빌드가 끝나면 macOS 앱을 실행합니다.

```sh
open build/native/MidiInstrumentApp_artefacts/MIDI\ Instrument\ API.app
```

이전 빌드에 JUCE가 받아져 있고 네트워크를 사용할 수 없다면, 보관된 JUCE 소스를 재사용해서 configure합니다.

```sh
cmake -S . -B build/native -DFETCHCONTENT_SOURCE_DIR_JUCE="$(pwd)/.local/legacy-builds/build/_deps/juce-src"
cmake --build build/native --target MidiInstrumentApp
```

이전 빌드 폴더는 `.local/legacy-builds/`에 보관되어 있습니다. CMake 캐시는 원래 경로를 기록하므로 이동된 빌드는 직접 재사용하지 않고 새 경로에 다시 구성합니다.

## 웹 WASM 빌드

Emscripten 설치 후:

```sh
npm run build:wasm
npm run serve
```

브라우저 경로:

- `http://localhost:8080/`: 프로필 홈
- `http://localhost:8080/midi/`: MIDI 테스트 화면

`/midi/`에서 `Start Audio`를 누르면 됩니다.

88건반은 왼쪽 A0(MIDI 21)부터 오른쪽 C8(MIDI 108) 순서입니다. 브라우저의
오디오 정책 때문에 먼저 `Start Audio`를 클릭한 뒤, 마우스나 터치로 건반을
누릅니다. 누른 포인터를 떼거나 입력이 취소되면 해당 음이 종료됩니다. 화면이
좁으면 건반 영역을 가로로 스크롤할 수 있습니다.

웹 API에서는 피아노 범위 검증이 포함된 메서드를 사용할 수 있습니다.

```js
api.pianoNoteOn(60, 0.9); // C4 시작
api.pianoNoteOff(60);     // C4 종료
```

코드는 근음(`C`~`B`, 반음은 `#`), 근음의 옥타브, 코드 종류로 구성합니다.
지원 종류는 `major`, `minor`, `diminished`, `augmented`, `major7`,
`dominant7`, `minor7`입니다. 피아노 범위를 벗어나는 코드는 `RangeError`,
알 수 없는 근음이나 종류는 `TypeError`를 발생시킵니다.

```js
api.chordNoteOn("G", 3, "dominant7", 0.9); // G3, B3, D4, F4 시작
api.chordNoteOff("G", 3, "dominant7");     // 같은 구성음 종료
```

MIDI 화면에서는 Start Audio 후 Root, Octave, Chord를 선택하고
`Hold to play` 버튼을 누르는 동안 코드를 연주할 수 있습니다.

### 건반 및 코드 녹음

`Start Audio` 후 `Record`를 누르고 건반이나 코드를 연주합니다. `Stop Recording`은
녹음을 끝내면서 아직 눌린 음도 종료합니다. `Play`는 note-on/note-off의 원래 순서와
간격, velocity를 재현하고, `Stop Playback`은 예약된 재생과 현재 재생 음을 끝냅니다.
`Clear`는 재생 중인 음을 끝내고 이벤트 큐를 비웁니다. 빈 녹음에서 Play를 눌러도
음을 내지 않습니다.

수동 확인: C4를 짧게 누른 뒤 G 메이저 코드를 겹쳐 연주하고 녹음을 정지합니다.
Play로 시작 순서, 겹침, 음 길이와 간격이 같은지 듣고, 재생 도중 Stop Playback 및
Clear를 눌러 남은 음이 즉시 종료되는지 확인합니다. 음을 누른 채 Stop Recording을
눌렀을 때도 소리가 멈춰야 합니다.

### 녹음 파일 저장 및 불러오기

`Save JSON`은 현재 큐를 서버 전송 없이 `midi-recording.json`으로 다운로드하고,
`Load JSON`은 로컬 JSON 파일을 선택해 검증 후 큐를 복원합니다. 불러오기에 실패하면
화면에 오류를 표시하고 현재 큐는 바꾸지 않습니다. 빈 큐도 저장하고 다시 불러올 수
있습니다. 파일 형식은 다음과 같으며 현재 지원 버전은 `1`입니다.

```json
{
  "version": 1,
  "events": [
    { "elapsedTime": 0, "midiNote": 60, "type": "note-on", "velocity": 0.9 },
    { "elapsedTime": 250, "midiNote": 60, "type": "note-off", "velocity": 0 }
  ]
}
```

웹 API에서는 `recording.toJSON()`으로 같은 형식을 만들고,
`recording.loadJSON(jsonText)`로 검증 및 복원합니다. 시간은 밀리초 단위의 0 이상
오름차순 값이고, MIDI 번호는 21~108, type은 `note-on` 또는 `note-off`, velocity는
0~1이어야 합니다.

전체 수동 흐름: Start Audio → Record → 연주 → Stop Recording → Save JSON → Clear
→ Load JSON → Play 순서로 실행해 원래 연주가 복원되는지 확인합니다. 잘못된 JSON과
`version`이 1이 아닌 파일도 불러와 오류가 표시되고 기존 녹음이 유지되는지 확인합니다.

### 저장 목록과 피아노 롤

`Save to list`는 현재 이벤트 큐의 복사본을 브라우저 메모리의 Map에 1번부터 차례로
저장합니다. 목록의 `Load N` 버튼 하나로 원하는 녹음을 큐에 복원할 수 있으며 여러
녹음을 동시에 보관할 수 있습니다. 이 목록은 페이지를 새로 고치면 사라지므로 영구
보관에는 `Save JSON`을 사용합니다.

녹음을 정지하거나 목록/JSON에서 불러오면 피아노 롤에 가로축 시간, 세로축 음높이로
음표가 표시됩니다. 각 음표에는 키와 옥타브가 표시되고, 같은 시점에 시작한 지원 코드
구성음은 상단에 코드 이름이 표시됩니다. `Play`를 누르면 분홍색 플레이헤드가 녹음
길이에 맞춰 왼쪽에서 오른쪽으로 등속 이동하며 `Stop Playback`에서 함께 멈춥니다.

수동 확인: 서로 다른 연주 두 개를 각각 녹음해 `Save to list`를 누르고 `Load 1`,
`Load 2`가 각 큐와 악보를 복원하는지 확인합니다. C 메이저 코드를 녹음하면 `C maj`와
`C4`, `E4`, `G4`가 표시되는지, Play 중 플레이헤드가 일정한 속도로 이동하는지도
확인합니다.

웹 건반/API 자동 테스트:

```sh
npm run test:web
```
