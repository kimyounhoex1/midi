# JUCE MIDI Instrument API

피아노, 드럼, 기타 샘플 기반 MIDI 엔진을 C++로 만들고, 같은 엔진을 데스크톱 JUCE 앱과 웹 WASM API에서 함께 쓰기 위한 초기 프로젝트입니다.

## 구조

- `src/core`: 순수 C++ MIDI/샘플 재생 엔진
- `src/app`: JUCE 데스크톱 앱
- `src/wasm`: 브라우저에서 호출할 C export API
- `web`: WASM을 호출하는 JavaScript API와 예제 페이지
- `assets/samples`: 교체 가능한 WAV 샘플 위치

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

처음 빌드할 때 JUCE를 GitHub에서 내려받습니다.

```sh
cmake -S . -B build
cmake --build build --target MidiInstrumentApp
```

## 웹 WASM 빌드

Emscripten 설치 후:

```sh
npm run build:wasm
npm run serve
```

브라우저에서 `http://localhost:8080`을 열고 `Start Audio`를 누르면 됩니다.
