import assert from "node:assert/strict";
import test from "node:test";

import {
  CHORD_ROOTS,
  CHORD_TYPES,
  MidiApi,
  getChordMidiNotes,
} from "../../web/midi-api.js";

function makeModule(calls) {
  return {
    _malloc: () => 0,
    _midi_set_instrument: (instrument) => calls.push(["instrument", instrument]),
    _midi_note_on: (note, velocity) => calls.push(["on", note, velocity]),
    _midi_note_off: (note) => calls.push(["off", note]),
  };
}

test("common chord examples return their expected MIDI notes", () => {
  assert.deepEqual(getChordMidiNotes("C", 4, "major"), [60, 64, 67]);
  assert.deepEqual(getChordMidiNotes("A", 3, "minor"), [57, 60, 64]);
  assert.deepEqual(getChordMidiNotes("G", 3, "dominant7"), [55, 59, 62, 65]);
});

test("every supported root and chord type uses the declared intervals", () => {
  assert.equal(CHORD_ROOTS.length, 12);
  assert.equal(Object.keys(CHORD_TYPES).length, 7);
  for (const [pitchClass, root] of CHORD_ROOTS.entries()) {
    for (const [type, intervals] of Object.entries(CHORD_TYPES)) {
      const rootNote = 48 + pitchClass;
      assert.deepEqual(
        getChordMidiNotes(root, 3, type),
        intervals.map((interval) => rootNote + interval),
        `${root} ${type}`,
      );
    }
  }
});

test("every supported root and chord type starts and stops all chord notes", () => {
  for (const root of CHORD_ROOTS) {
    for (const type of Object.keys(CHORD_TYPES)) {
      const calls = [];
      const api = new MidiApi(makeModule(calls), 44100, 512);
      const notes = getChordMidiNotes(root, 3, type);
      api.chordNoteOn(root, 3, type, 0.6);
      api.chordNoteOff(root, 3, type);
      assert.deepEqual(calls, [
        ...notes.map((note) => ["on", note, 0.6]),
        ...notes.map((note) => ["off", note]),
      ], `${root} ${type}`);
    }
  }
});

test("chord API starts and stops every note simultaneously as one operation", () => {
  const calls = [];
  const api = new MidiApi(makeModule(calls), 44100, 512);
  assert.deepEqual(api.chordNoteOn("C", 4, "major7", 0.7), [60, 64, 67, 71]);
  assert.deepEqual(api.chordNoteOff("C", 4, "major7"), [60, 64, 67, 71]);
  assert.deepEqual(calls, [
    ["on", 60, 0.7], ["on", 64, 0.7], ["on", 67, 0.7], ["on", 71, 0.7],
    ["off", 60], ["off", 64], ["off", 67], ["off", 71],
  ]);
});

test("invalid and out-of-range chords fail before playing any note", () => {
  for (const args of [
    ["H", 4, "major"], ["C", 4.5, "major"], ["C", 4, "sus4"],
    ["C", 0, "major"], ["B", 7, "major"],
  ]) {
    assert.throws(() => getChordMidiNotes(...args), args[0] === "H" || args[1] === 4.5 || args[2] === "sus4" ? TypeError : RangeError);
  }

  const calls = [];
  const api = new MidiApi(makeModule(calls), 44100, 512);
  assert.throws(() => api.chordNoteOn("B", 7, "major"), RangeError);
  assert.deepEqual(calls, []);
});
