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
- `PLAN.md`, `PROGRESS.md`, `REPORT.md`: 작업 계획, 진행 기록, 결과 보고
- `.ai/guide`: 로컬 학습 문서. `.ai/runs`: 자동 실행 로그 (Git 제외)
- `.vscode`: 로컬 VS Code 설정 (Git 제외)
- `build/core`, `build/native`, `build/wasm`: 환경별 빌드 산출물 (Git 제외)
- `.local/legacy-builds`: 이전 빌드 폴더 보관 위치 (Git 제외)

## Codex 작업 자동화

Python 3, Node.js, Codex CLI가 필요하다. 가상환경과 별도의 Python 패키지는 필요 없다. Codex CLI 로그인 상태를 먼저 확인한다.

1. `PLAN.md`에 `## TASK-001` 형식으로 작업과 완료 조건을 작성한다.
2. `python3 scripts/overnight.py --dry-run`으로 실행할 작업을 확인한다.
3. `python3 scripts/overnight.py --task TASK-001`로 첫 작업만 실행한다. `--task`를 생략하면 계획된 작업을 순서대로 실행한다.
4. `PROGRESS.md`, `REPORT.md`, `.ai/runs/` 로그와 Git diff를 확인한다.

각 작업은 최대 세 번 실행하며 Codex 실행 후 `npm run test:core`를 별도로 검증한다. core 테스트 통과만으로 모든 완료 조건이 충족되는 것은 아니므로 결과를 검토하고 작업별 필요한 추가 테스트를 확인한다. 실패하면 다음 작업으로 넘어가지 않는다. 작업을 다시 실행하면 완료된 작업도 다시 실행되므로 계획이나 `--task`를 확인한다.

macOS에서 실행 중 유휴 잠자기를 방지하려면 `caffeinate -i python3 scripts/overnight.py`를 사용한다. 터미널 종료 후에도 유지하려면 별도 `tmux` 세션에서 실행할 수 있다. 노트북 덮개를 닫거나 시스템을 종료하면 중단될 수 있다.

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

웹 건반/API 자동 테스트:

```sh
npm run test:web
```
