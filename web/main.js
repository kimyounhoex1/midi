import { MidiApi } from "./midi-api.js";
import { createPianoKeyboard } from "./piano-keyboard.js";
import { MidiRecording } from "./recording.js";
import { detectChords, eventsToPianoRoll, RecordingLibrary } from "./sequencer.js";

let audioContext;
let api;
let processor;
const recording = new MidiRecording();
const recordingLibrary = new RecordingLibrary();

const startButton = document.querySelector("#start");
const statusText = document.querySelector("#status");
const instrumentSelect = document.querySelector("#instrument");
const pianoKeyboard = document.querySelector("#piano-keyboard");
const chordRoot = document.querySelector("#chord-root");
const chordOctave = document.querySelector("#chord-octave");
const chordType = document.querySelector("#chord-type");
const playChordButton = document.querySelector("#play-chord");
const recordButton = document.querySelector("#record");
const stopRecordingButton = document.querySelector("#stop-recording");
const playbackButton = document.querySelector("#play-recording");
const stopPlaybackButton = document.querySelector("#stop-playback");
const clearRecordingButton = document.querySelector("#clear-recording");
const saveRecordingButton = document.querySelector("#save-recording");
const loadRecordingButton = document.querySelector("#load-recording");
const recordingFileInput = document.querySelector("#recording-file");
const saveSlotButton = document.querySelector("#save-slot");
const recordingSlots = document.querySelector("#recording-slots");
const pianoRoll = document.querySelector("#piano-roll");
const rollNotes = document.querySelector("#roll-notes");
const rollChords = document.querySelector("#roll-chords");
const rollSummary = document.querySelector("#roll-summary");
const playhead = document.querySelector("#playhead");
let activeChord;
let rollDuration = 0;
let playheadFrame;
let playbackStartedAt;

const renderPianoRoll = () => {
  const { notes, duration } = eventsToPianoRoll(recording.getEvents());
  rollDuration = duration;
  rollNotes.replaceChildren();
  rollChords.replaceChildren();
  const width = Math.max(720, duration * 0.25 + 120);
  pianoRoll.style.width = `${width}px`;
  for (const note of notes) {
    const element = document.createElement("div");
    element.className = "roll-note";
    element.textContent = note.name;
    element.title = `${note.name} · velocity ${note.velocity}`;
    element.style.left = `${duration ? (note.start / duration) * 100 : 0}%`;
    element.style.width = `${duration ? Math.max(0.7, (note.duration / duration) * 100) : 1}%`;
    element.style.setProperty("--pitch", String(108 - note.midiNote));
    rollNotes.append(element);
  }
  for (const chord of detectChords(notes)) {
    const element = document.createElement("span");
    element.className = "roll-chord";
    element.textContent = chord.name;
    element.style.left = `${duration ? (chord.start / duration) * 100 : 0}%`;
    rollChords.append(element);
  }
  rollSummary.textContent = `${notes.length} notes · ${(duration / 1000).toFixed(2)} s`;
  playhead.style.left = "0%";
};

const stopPlayhead = () => {
  cancelAnimationFrame(playheadFrame);
  playheadFrame = undefined;
  playhead.hidden = true;
};

const animatePlayhead = (now) => {
  const elapsed = now - playbackStartedAt;
  playhead.style.left = `${Math.min(100, (elapsed / rollDuration) * 100)}%`;
  if (elapsed < rollDuration) playheadFrame = requestAnimationFrame(animatePlayhead);
  else stopPlayhead();
};

const startPlayhead = () => {
  stopPlayhead();
  if (rollDuration <= 0) return;
  playbackStartedAt = performance.now();
  playhead.hidden = false;
  playheadFrame = requestAnimationFrame(animatePlayhead);
};

const renderRecordingSlots = () => {
  recordingSlots.replaceChildren();
  for (const [id, events] of recordingLibrary.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Load ${id} (${events.length} events)`;
    button.addEventListener("click", () => {
      recording.loadEvents(recordingLibrary.get(id));
      renderPianoRoll();
      statusText.textContent = `저장된 녹음 ${id} 불러오기 완료`;
    });
    recordingSlots.append(button);
  }
};

createPianoKeyboard(pianoKeyboard, () => api);

const stopChord = () => {
  if (!api || !activeChord) return;
  api.chordNoteOff(activeChord.root, activeChord.octave, activeChord.type);
  activeChord = undefined;
  playChordButton.classList.remove("is-active");
};

playChordButton.addEventListener("pointerdown", (event) => {
  if (!api || activeChord) return;
  event.preventDefault();
  const chord = {
    root: chordRoot.value,
    octave: Number(chordOctave.value),
    type: chordType.value,
  };
  try {
    api.chordNoteOn(chord.root, chord.octave, chord.type, 0.9);
    activeChord = chord;
    playChordButton.classList.add("is-active");
    playChordButton.setPointerCapture?.(event.pointerId);
    statusText.textContent = `${chord.root}${chord.octave} ${chord.type}`;
  } catch (error) {
    statusText.textContent = error.message;
  }
});
playChordButton.addEventListener("pointerup", stopChord);
playChordButton.addEventListener("pointercancel", stopChord);
playChordButton.addEventListener("lostpointercapture", stopChord);

recordButton.addEventListener("click", () => {
  try {
    recording.startRecording();
    statusText.textContent = "녹음 중";
  } catch (error) {
    statusText.textContent = error.message;
  }
});
stopRecordingButton.addEventListener("click", () => {
  stopChord();
  recording.stopRecording();
  renderPianoRoll();
  statusText.textContent = `녹음 정지 (${recording.getEvents().length} events)`;
});
playbackButton.addEventListener("click", () => {
  try {
    const playing = recording.play();
    if (playing) startPlayhead();
    statusText.textContent = playing ? "녹음 재생 중" : "재생할 녹음이 없습니다";
  } catch (error) {
    statusText.textContent = error.message;
  }
});
stopPlaybackButton.addEventListener("click", () => {
  recording.stopPlayback();
  stopPlayhead();
  statusText.textContent = "재생 정지";
});
clearRecordingButton.addEventListener("click", () => {
  stopChord();
  recording.clear();
  stopPlayhead();
  renderPianoRoll();
  statusText.textContent = "녹음 초기화";
});
saveRecordingButton.addEventListener("click", () => {
  const blob = new Blob([recording.toJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "midi-recording.json";
  link.click();
  URL.revokeObjectURL(url);
  statusText.textContent = `녹음 저장 (${recording.getEvents().length} events)`;
});
loadRecordingButton.addEventListener("click", () => recordingFileInput.click());
recordingFileInput.addEventListener("change", async () => {
  const [file] = recordingFileInput.files;
  if (!file) return;
  try {
    const events = recording.loadJSON(await file.text());
    renderPianoRoll();
    statusText.textContent = `녹음 불러오기 완료 (${events.length} events)`;
  } catch (error) {
    statusText.textContent = `불러오기 실패: ${error.message}`;
  } finally {
    recordingFileInput.value = "";
  }
});

saveSlotButton.addEventListener("click", () => {
  const id = recordingLibrary.save(recording.getEvents());
  renderRecordingSlots();
  renderPianoRoll();
  statusText.textContent = `녹음 ${id} 저장 (${recording.getEvents().length} events)`;
});

renderPianoRoll();

startButton.addEventListener("click", async () => {
  audioContext = new AudioContext();
  await audioContext.resume();
  api = await MidiApi.create({
    sampleRate: audioContext.sampleRate,
    blockSize: 512,
  });
  recording.setApi(api);

  processor = audioContext.createScriptProcessor(512, 0, 2);
  processor.onaudioprocess = (event) => {
    const rendered = api.render();
    event.outputBuffer.getChannelData(0).set(rendered.left);
    event.outputBuffer.getChannelData(1).set(rendered.right);
  };
  processor.connect(audioContext.destination);

  api.setInstrument(instrumentSelect.value);
  instrumentSelect.value = "piano";
  instrumentSelect.disabled = true;
  startButton.disabled = true;
  statusText.textContent = "준비 완료";
});
