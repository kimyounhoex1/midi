import assert from "node:assert/strict";
import test from "node:test";

import { MidiApi } from "../../web/midi-api.js";

function makeModule(calls) {
  return {
    _malloc: () => 0,
    _midi_set_instrument: (instrument) => calls.push(["instrument", instrument]),
    _midi_note_on: (note, velocity) => calls.push(["on", note, velocity]),
    _midi_note_off: (note) => calls.push(["off", note]),
  };
}

test("piano API starts and stops every key from A0 through C8", () => {
  const calls = [];
  const api = new MidiApi(makeModule(calls), 44100, 512);

  for (let note = 21; note <= 108; note += 1) {
    api.pianoNoteOn(note, 0.9);
    api.pianoNoteOff(note);
  }

  assert.equal(calls.filter(([type]) => type === "on").length, 88);
  assert.deepEqual(calls.filter(([type]) => type === "on").map(([, note]) => note),
    Array.from({ length: 88 }, (_, index) => index + 21));
  assert.deepEqual(calls.find(([type, note]) => type === "on" && note === 60), ["on", 60, 0.9]);
  assert.equal(calls.filter(([type]) => type === "off").length, 88);
});

test("piano API rejects notes outside the 88-key range and non-integers", () => {
  const api = new MidiApi(makeModule([]), 44100, 512);
  for (const note of [20, 109, 60.5, NaN, "60"]) {
    assert.throws(() => api.pianoNoteOn(note), RangeError);
    assert.throws(() => api.pianoNoteOff(note), RangeError);
  }
});
