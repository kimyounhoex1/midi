export class MidiApi {
  static async create(options = {}) {
    const sampleRate = options.sampleRate ?? 44100;
    const blockSize = options.blockSize ?? 512;
    const wasmFactory = options.wasmFactory ?? window.createMidiModule;

    if (!wasmFactory) {
      throw new Error("web/dist/midi_wasm.js must be loaded before midi-api.js");
    }

    const module = await wasmFactory();
    const api = new MidiApi(module, sampleRate, blockSize);
    api.prepare();
    return api;
  }

  constructor(module, sampleRate, blockSize) {
    this.module = module;
    this.sampleRate = sampleRate;
    this.blockSize = blockSize;
    this.currentInstrument = "piano";
    this.noteEventListeners = new Set();
    this.leftPtr = module._malloc(blockSize * Float32Array.BYTES_PER_ELEMENT);
    this.rightPtr = module._malloc(blockSize * Float32Array.BYTES_PER_ELEMENT);
  }

  prepare() {
    this.module._midi_prepare(this.sampleRate, this.blockSize);
  }

  setInstrument(name) {
    const id = name === "drums" || name === "drum" ? 1 : name === "guitar" ? 2 : 0;
    this.module._midi_set_instrument(id);
    this.currentInstrument = id === 1 ? "drums" : id === 2 ? "guitar" : "piano";
  }

  noteOn(midiNote, velocity = 0.8) {
    this.module._midi_note_on(midiNote, velocity);
    this.emitNoteEvent("note-on", midiNote, velocity);
  }

  noteOff(midiNote) {
    this.module._midi_note_off(midiNote);
    this.emitNoteEvent("note-off", midiNote, 0);
  }

  pianoNoteOn(midiNote, velocity = 0.8) {
    assertPianoMidiNote(midiNote);
    if (this.currentInstrument !== "piano") this.setInstrument("piano");
    this.module._midi_note_on(midiNote, velocity);
    this.emitNoteEvent("note-on", midiNote, velocity);
  }

  pianoNoteOff(midiNote) {
    assertPianoMidiNote(midiNote);
    this.module._midi_note_off(midiNote);
    this.emitNoteEvent("note-off", midiNote, 0);
  }

  chordNoteOn(root, octave, type, velocity = 0.8) {
    const notes = getChordMidiNotes(root, octave, type);
    if (this.currentInstrument !== "piano") this.setInstrument("piano");
    for (const note of notes) {
      this.module._midi_note_on(note, velocity);
      this.emitNoteEvent("note-on", note, velocity);
    }
    return notes;
  }

  chordNoteOff(root, octave, type) {
    const notes = getChordMidiNotes(root, octave, type);
    for (const note of notes) {
      this.module._midi_note_off(note);
      this.emitNoteEvent("note-off", note, 0);
    }
    return notes;
  }

  allNotesOff() {
    this.module._midi_all_notes_off();
  }

  addNoteEventListener(listener) {
    this.noteEventListeners.add(listener);
    return () => this.noteEventListeners.delete(listener);
  }

  emitNoteEvent(type, midiNote, velocity) {
    const event = Object.freeze({ type, midiNote, velocity });
    for (const listener of this.noteEventListeners) listener(event);
  }

  render() {
    this.module._midi_render(this.leftPtr, this.rightPtr, this.blockSize);
    const leftOffset = this.leftPtr / Float32Array.BYTES_PER_ELEMENT;
    const rightOffset = this.rightPtr / Float32Array.BYTES_PER_ELEMENT;
    return {
      left: this.module.HEAPF32.subarray(leftOffset, leftOffset + this.blockSize),
      right: this.module.HEAPF32.subarray(rightOffset, rightOffset + this.blockSize),
    };
  }

  destroy() {
    this.module._free(this.leftPtr);
    this.module._free(this.rightPtr);
  }
}

export const PIANO_LOWEST_MIDI_NOTE = 21;
export const PIANO_HIGHEST_MIDI_NOTE = 108;

export const CHORD_ROOTS = Object.freeze([
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
]);

export const CHORD_TYPES = Object.freeze({
  major: Object.freeze([0, 4, 7]),
  minor: Object.freeze([0, 3, 7]),
  diminished: Object.freeze([0, 3, 6]),
  augmented: Object.freeze([0, 4, 8]),
  major7: Object.freeze([0, 4, 7, 11]),
  dominant7: Object.freeze([0, 4, 7, 10]),
  minor7: Object.freeze([0, 3, 7, 10]),
});

export function getChordMidiNotes(root, octave, type) {
  const pitchClass = CHORD_ROOTS.indexOf(root);
  if (pitchClass === -1) {
    throw new TypeError(`Unknown chord root: ${String(root)}`);
  }
  if (!Number.isInteger(octave)) {
    throw new TypeError("Chord octave must be an integer");
  }
  const intervals = CHORD_TYPES[type];
  if (!intervals) {
    throw new TypeError(`Unknown chord type: ${String(type)}`);
  }

  const rootMidiNote = (octave + 1) * 12 + pitchClass;
  const notes = intervals.map((interval) => rootMidiNote + interval);
  if (notes.some((note) => note < PIANO_LOWEST_MIDI_NOTE || note > PIANO_HIGHEST_MIDI_NOTE)) {
    throw new RangeError(
      `Chord ${root}${octave} ${type} is outside the piano range A0 (21) to C8 (108)`,
    );
  }
  return notes;
}

function assertPianoMidiNote(midiNote) {
  if (
    !Number.isInteger(midiNote) ||
    midiNote < PIANO_LOWEST_MIDI_NOTE ||
    midiNote > PIANO_HIGHEST_MIDI_NOTE
  ) {
    throw new RangeError("Piano MIDI note must be an integer from 21 (A0) to 108 (C8)");
  }
}
