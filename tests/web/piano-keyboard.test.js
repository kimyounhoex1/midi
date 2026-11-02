import assert from "node:assert/strict";
import test from "node:test";

import { bindPianoKey, createPianoNotes } from "../../web/piano-keyboard.js";

class FakeKey extends EventTarget {
  dataset = { note: "60" };
  active = false;
  classList = {
    add: () => { this.active = true; },
    remove: () => { this.active = false; },
  };
  setPointerCapture(pointerId) { this.capturedPointer = pointerId; }
}

function pointerEvent(type, pointerId) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
}

test("piano definition contains 88 ordered keys with 52 white and 36 black", () => {
  const notes = createPianoNotes();
  assert.equal(notes.length, 88);
  assert.deepEqual(notes[0], { midiNote: 21, name: "A0", isWhiteKey: true, whiteIndex: 0 });
  assert.equal(notes.find(({ midiNote }) => midiNote === 60).name, "C4");
  assert.equal(notes.at(-1).name, "C8");
  assert.equal(notes.filter(({ isWhiteKey }) => isWhiteKey).length, 52);
  assert.equal(notes.filter(({ isWhiteKey }) => !isWhiteKey).length, 36);
});

test("pointer release and cancellation stop exactly the active note", () => {
  for (const endEvent of ["pointerup", "pointercancel", "lostpointercapture"]) {
    const calls = [];
    const key = new FakeKey();
    bindPianoKey(key, () => ({
      pianoNoteOn: (...args) => calls.push(["on", ...args]),
      pianoNoteOff: (...args) => calls.push(["off", ...args]),
    }));

    key.dispatchEvent(pointerEvent("pointerdown", 7));
    assert.equal(key.active, true);
    assert.equal(key.capturedPointer, 7);
    key.dispatchEvent(pointerEvent(endEvent, 7));
    key.dispatchEvent(pointerEvent(endEvent, 7));

    assert.deepEqual(calls, [["on", 60, 0.9], ["off", 60]]);
    assert.equal(key.active, false);
  }
});

test("pointer input does not start before the audio API exists", () => {
  const key = new FakeKey();
  bindPianoKey(key, () => undefined);
  key.dispatchEvent(pointerEvent("pointerdown", 1));
  assert.equal(key.active, false);
  assert.equal(key.capturedPointer, undefined);
});
