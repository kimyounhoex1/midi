import {
  PIANO_HIGHEST_MIDI_NOTE,
  PIANO_LOWEST_MIDI_NOTE,
} from "./midi-api.js";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

export function createPianoNotes() {
  const notes = [];
  let whiteIndex = 0;

  for (let midiNote = PIANO_LOWEST_MIDI_NOTE; midiNote <= PIANO_HIGHEST_MIDI_NOTE; midiNote += 1) {
    const pitchClass = midiNote % 12;
    const isWhiteKey = WHITE_PITCH_CLASSES.has(pitchClass);
    notes.push({
      midiNote,
      name: `${NOTE_NAMES[pitchClass]}${Math.floor(midiNote / 12) - 1}`,
      isWhiteKey,
      whiteIndex: isWhiteKey ? whiteIndex++ : whiteIndex - 0.5,
    });
  }

  return notes;
}

export function bindPianoKey(key, getApi) {
  const midiNote = Number(key.dataset.note);
  const activePointers = new Set();

  const release = (event) => {
    if (!activePointers.delete(event.pointerId)) return;
    key.classList.remove("is-active");
    getApi()?.pianoNoteOff(midiNote);
  };

  key.addEventListener("pointerdown", (event) => {
    const api = getApi();
    if (!api || activePointers.has(event.pointerId)) return;

    event.preventDefault();
    activePointers.add(event.pointerId);
    key.classList.add("is-active");
    key.setPointerCapture?.(event.pointerId);
    api.pianoNoteOn(midiNote, 0.9);
  });
  key.addEventListener("pointerup", release);
  key.addEventListener("pointercancel", release);
  key.addEventListener("lostpointercapture", release);
}

export function createPianoKeyboard(container, getApi) {
  const notes = createPianoNotes();
  container.style.setProperty("--white-key-count", String(notes.filter((note) => note.isWhiteKey).length));

  for (const note of notes) {
    const key = container.ownerDocument.createElement("button");
    key.type = "button";
    key.className = `piano-key piano-key--${note.isWhiteKey ? "white" : "black"}`;
    key.dataset.note = String(note.midiNote);
    key.setAttribute("aria-label", `${note.name}, MIDI ${note.midiNote}`);
    key.title = note.name;
    if (!note.isWhiteKey) key.style.setProperty("--white-index", String(note.whiteIndex));
    key.innerHTML = `<span>${note.name}</span>`;
    bindPianoKey(key, getApi);
    container.append(key);
  }

  return notes;
}
