import assert from "node:assert/strict";
import test from "node:test";

import { detectChords, eventsToPianoRoll, midiNoteName, RecordingLibrary } from "../../web/sequencer.js";

const events = [
  { elapsedTime: 0, midiNote: 60, type: "note-on", velocity: 0.8 },
  { elapsedTime: 0, midiNote: 64, type: "note-on", velocity: 0.7 },
  { elapsedTime: 0, midiNote: 67, type: "note-on", velocity: 0.6 },
  { elapsedTime: 250, midiNote: 60, type: "note-off", velocity: 0 },
  { elapsedTime: 250, midiNote: 64, type: "note-off", velocity: 0 },
  { elapsedTime: 250, midiNote: 67, type: "note-off", velocity: 0 },
];

test("converts event queue to timed piano-roll notes with key and octave", () => {
  const roll = eventsToPianoRoll(events);
  assert.equal(roll.duration, 250);
  assert.deepEqual(roll.notes.map(({ name, start, duration }) => ({ name, start, duration })), [
    { name: "C4", start: 0, duration: 250 },
    { name: "E4", start: 0, duration: 250 },
    { name: "G4", start: 0, duration: 250 },
  ]);
  assert.equal(midiNoteName(21), "A0");
  assert.equal(midiNoteName(108), "C8");
});

test("labels supported simultaneous notes as a chord", () => {
  assert.deepEqual(detectChords(eventsToPianoRoll(events).notes), [{ start: 0, name: "C maj" }]);
});

test("stores multiple independent recordings in an increasing Map key", () => {
  const library = new RecordingLibrary();
  assert.equal(library.recordings instanceof Map, true);
  assert.equal(library.save(events), 1);
  assert.equal(library.save([]), 2);
  const loaded = library.get(1);
  loaded[0].midiNote = 99;
  assert.equal(library.get(1)[0].midiNote, 60);
  assert.deepEqual(library.entries().map(([id]) => id), [1, 2]);
});
