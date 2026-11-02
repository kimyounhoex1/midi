import assert from "node:assert/strict";
import test from "node:test";

import { MidiApi } from "../../web/midi-api.js";
import {
  MidiRecording,
  RECORDING_FILE_VERSION,
  parseRecordingFile,
} from "../../web/recording.js";

function makeFixture() {
  let time = 0;
  let nextTimer = 1;
  const calls = [];
  const tasks = new Map();
  const module = {
    _malloc: () => 0,
    _midi_set_instrument: () => {},
    _midi_note_on: (note, velocity) => calls.push([time, "on", note, velocity]),
    _midi_note_off: (note) => calls.push([time, "off", note, 0]),
    _midi_all_notes_off: () => calls.push([time, "all-off"]),
  };
  const api = new MidiApi(module, 44100, 512);
  const recording = new MidiRecording({
    now: () => time,
    schedule: (callback, delay) => {
      const id = nextTimer++;
      tasks.set(id, { callback, at: time + delay });
      return id;
    },
    cancelSchedule: (id) => tasks.delete(id),
  });
  recording.setApi(api);
  return {
    api,
    calls,
    recording,
    setTime: (value) => { time = value; },
    runPlayback: () => {
      while (tasks.size) {
        const [id, task] = [...tasks].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        tasks.delete(id);
        time = task.at;
        task.callback();
      }
    },
    runNext: () => {
      const [id, task] = [...tasks].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      tasks.delete(id);
      time = task.at;
      task.callback();
    },
    pendingTasks: () => tasks.size,
  };
}

test("records and replays a single note with its timing and velocity", () => {
  const fixture = makeFixture();
  fixture.recording.startRecording();
  fixture.setTime(25);
  fixture.api.pianoNoteOn(60, 0.7);
  fixture.setTime(125);
  fixture.api.pianoNoteOff(60);
  fixture.recording.stopRecording();

  assert.deepEqual(fixture.recording.getEvents(), [
    { elapsedTime: 25, midiNote: 60, type: "note-on", velocity: 0.7 },
    { elapsedTime: 125, midiNote: 60, type: "note-off", velocity: 0 },
  ]);
  fixture.calls.length = 0;
  fixture.setTime(1000);
  assert.equal(fixture.recording.play(), true);
  fixture.runPlayback();
  assert.deepEqual(fixture.calls, [
    [1025, "on", 60, 0.7],
    [1125, "off", 60, 0],
  ]);
});

test("records every chord note as an individual simultaneous event", () => {
  const fixture = makeFixture();
  fixture.recording.startRecording();
  fixture.setTime(10);
  fixture.api.chordNoteOn("C", 4, "major", 0.8);
  fixture.setTime(70);
  fixture.api.chordNoteOff("C", 4, "major");
  fixture.recording.stopRecording();
  assert.deepEqual(fixture.recording.getEvents().map((event) => [event.elapsedTime, event.type, event.midiNote, event.velocity]), [
    [10, "note-on", 60, 0.8], [10, "note-on", 64, 0.8], [10, "note-on", 67, 0.8],
    [70, "note-off", 60, 0], [70, "note-off", 64, 0], [70, "note-off", 67, 0],
  ]);
});

test("preserves overlapping notes in chronological order", () => {
  const fixture = makeFixture();
  fixture.recording.startRecording();
  fixture.api.pianoNoteOn(60, 0.5);
  fixture.setTime(20);
  fixture.api.pianoNoteOn(64, 0.9);
  fixture.setTime(40);
  fixture.api.pianoNoteOff(60);
  fixture.setTime(80);
  fixture.api.pianoNoteOff(64);
  fixture.recording.stopRecording();
  assert.deepEqual(fixture.recording.getEvents().map(({ elapsedTime, type, midiNote }) => [elapsedTime, type, midiNote]), [
    [0, "note-on", 60], [20, "note-on", 64], [40, "note-off", 60], [80, "note-off", 64],
  ]);
});

test("empty recording has nothing to play", () => {
  const fixture = makeFixture();
  fixture.recording.startRecording();
  fixture.recording.stopRecording();
  assert.equal(fixture.recording.play(), false);
  assert.equal(fixture.pendingTasks(), 0);
});

test("stopping recording adds note-offs for held notes", () => {
  const fixture = makeFixture();
  fixture.recording.startRecording();
  fixture.api.pianoNoteOn(60, 0.8);
  fixture.setTime(50);
  fixture.recording.stopRecording();
  assert.deepEqual(fixture.recording.getEvents(), [
    { elapsedTime: 0, midiNote: 60, type: "note-on", velocity: 0.8 },
    { elapsedTime: 50, midiNote: 60, type: "note-off", velocity: 0 },
  ]);
});

test("stopping playback or clearing cancels future events and releases sounding notes", () => {
  for (const action of ["stopPlayback", "clear"]) {
    const fixture = makeFixture();
    fixture.recording.startRecording();
    fixture.api.pianoNoteOn(60, 0.8);
    fixture.setTime(100);
    fixture.api.pianoNoteOff(60);
    fixture.recording.stopRecording();
    fixture.calls.length = 0;
    fixture.setTime(1000);
    fixture.recording.play();
    fixture.runNext();
    fixture.recording[action]();
    assert.deepEqual(fixture.calls, [[1000, "on", 60, 0.8], [1000, "off", 60, 0]], action);
    assert.equal(fixture.pendingTasks(), 0, action);
    if (action === "clear") assert.deepEqual(fixture.recording.getEvents(), []);
  }
});

test("recording JSON round-trips events and can be replayed", () => {
  const source = makeFixture();
  source.recording.startRecording();
  source.setTime(15);
  source.api.pianoNoteOn(60, 0.75);
  source.setTime(90);
  source.api.pianoNoteOff(60);
  source.recording.stopRecording();

  const json = source.recording.toJSON();
  assert.deepEqual(JSON.parse(json), {
    version: RECORDING_FILE_VERSION,
    events: source.recording.getEvents(),
  });

  const restored = makeFixture();
  assert.deepEqual(restored.recording.loadJSON(json), source.recording.getEvents());
  assert.equal(restored.recording.play(), true);
  restored.runPlayback();
  assert.deepEqual(restored.calls, [
    [15, "on", 60, 0.75],
    [90, "off", 60, 0],
  ]);
});

test("empty recording JSON round-trips", () => {
  const fixture = makeFixture();
  const json = fixture.recording.toJSON();
  fixture.recording.loadJSON(json);
  assert.deepEqual(fixture.recording.getEvents(), []);
  assert.equal(fixture.recording.play(), false);
});

test("invalid JSON and unsupported versions preserve the current recording", () => {
  const fixture = makeFixture();
  fixture.recording.startRecording();
  fixture.api.pianoNoteOn(64, 0.5);
  fixture.setTime(30);
  fixture.api.pianoNoteOff(64);
  fixture.recording.stopRecording();
  const original = fixture.recording.getEvents();

  for (const json of [
    "{invalid",
    JSON.stringify({ version: 2, events: [] }),
    JSON.stringify({ version: RECORDING_FILE_VERSION, events: [{
      elapsedTime: 0, midiNote: 200, type: "note-on", velocity: 0.5,
    }] }),
  ]) {
    assert.throws(() => fixture.recording.loadJSON(json));
    assert.deepEqual(fixture.recording.getEvents(), original);
  }
});

test("recording parser rejects malformed event queues", () => {
  for (const events of [
    {},
    [{ elapsedTime: -1, midiNote: 60, type: "note-on", velocity: 0.5 }],
    [{ elapsedTime: 0, midiNote: 60, type: "invalid", velocity: 0.5 }],
    [{ elapsedTime: 0, midiNote: 60, type: "note-on", velocity: 2 }],
    [
      { elapsedTime: 10, midiNote: 60, type: "note-on", velocity: 0.5 },
      { elapsedTime: 5, midiNote: 60, type: "note-off", velocity: 0 },
    ],
  ]) {
    assert.throws(() => parseRecordingFile(JSON.stringify({
      version: RECORDING_FILE_VERSION,
      events,
    })));
  }
});
