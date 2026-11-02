export const RECORDING_FILE_VERSION = 1;

function validateEvent(event, index, previousElapsedTime) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError(`Event ${index} must be an object`);
  }
  const { elapsedTime, midiNote, type, velocity } = event;
  if (!Number.isFinite(elapsedTime) || elapsedTime < 0 || elapsedTime < previousElapsedTime) {
    throw new RangeError(`Event ${index} has an invalid elapsedTime`);
  }
  if (!Number.isInteger(midiNote) || midiNote < 21 || midiNote > 108) {
    throw new RangeError(`Event ${index} has an invalid midiNote`);
  }
  if (type !== "note-on" && type !== "note-off") {
    throw new TypeError(`Event ${index} has an invalid type`);
  }
  if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) {
    throw new RangeError(`Event ${index} has an invalid velocity`);
  }
  return { elapsedTime, midiNote, type, velocity };
}

export function parseRecordingFile(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new SyntaxError("Recording file is not valid JSON");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("Recording file must contain an object");
  }
  if (data.version !== RECORDING_FILE_VERSION) {
    throw new RangeError(`Unsupported recording version: ${String(data.version)}`);
  }
  if (!Array.isArray(data.events)) {
    throw new TypeError("Recording file events must be an array");
  }

  let previousElapsedTime = 0;
  const events = data.events.map((event, index) => {
    const validated = validateEvent(event, index, previousElapsedTime);
    previousElapsedTime = validated.elapsedTime;
    return validated;
  });
  return { version: RECORDING_FILE_VERSION, events };
}

export class MidiRecording {
  constructor(options = {}) {
    this.now = options.now ?? (() => performance.now());
    this.schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.cancelSchedule = options.cancelSchedule ?? ((timer) => clearTimeout(timer));
    this.events = [];
    this.recording = false;
    this.playing = false;
    this.activeRecordedNotes = new Map();
    this.playbackNotes = new Map();
    this.timers = new Set();
  }

  setApi(api) {
    this.unsubscribe?.();
    this.api = api;
    this.unsubscribe = api?.addNoteEventListener((event) => this.capture(event));
  }

  startRecording() {
    if (!this.api) throw new Error("Start audio before recording");
    this.stopPlayback();
    this.events = [];
    this.activeRecordedNotes.clear();
    this.startedAt = this.now();
    this.recording = true;
  }

  stopRecording() {
    if (!this.recording) return;
    for (const [midiNote, count] of this.activeRecordedNotes) {
      for (let index = 0; index < count; index += 1) this.api.pianoNoteOff(midiNote);
    }
    this.activeRecordedNotes.clear();
    this.recording = false;
  }

  capture({ type, midiNote, velocity }) {
    if (!this.recording) return;
    this.events.push({
      elapsedTime: Math.max(0, this.now() - this.startedAt),
      midiNote,
      type,
      velocity,
    });
    if (type === "note-on") {
      this.activeRecordedNotes.set(midiNote, (this.activeRecordedNotes.get(midiNote) ?? 0) + 1);
    } else {
      const remaining = (this.activeRecordedNotes.get(midiNote) ?? 0) - 1;
      if (remaining > 0) this.activeRecordedNotes.set(midiNote, remaining);
      else this.activeRecordedNotes.delete(midiNote);
    }
  }

  play() {
    if (!this.api) throw new Error("Start audio before playback");
    this.stopRecording();
    this.stopPlayback();
    if (this.events.length === 0) return false;
    this.playing = true;
    for (const event of this.events) {
      this.addTimer(() => this.playEvent(event), event.elapsedTime);
    }
    const duration = this.events[this.events.length - 1].elapsedTime;
    this.addTimer(() => this.finishPlayback(), duration + 1);
    return true;
  }

  playEvent(event) {
    if (!this.playing) return;
    if (event.type === "note-on") {
      this.api.pianoNoteOn(event.midiNote, event.velocity);
      this.playbackNotes.set(event.midiNote, (this.playbackNotes.get(event.midiNote) ?? 0) + 1);
    } else {
      this.api.pianoNoteOff(event.midiNote);
      const remaining = (this.playbackNotes.get(event.midiNote) ?? 0) - 1;
      if (remaining > 0) this.playbackNotes.set(event.midiNote, remaining);
      else this.playbackNotes.delete(event.midiNote);
    }
  }

  addTimer(callback, delay) {
    let timer;
    timer = this.schedule(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
  }

  stopPlayback() {
    for (const timer of this.timers) this.cancelSchedule(timer);
    this.timers.clear();
    if (this.playing) {
      for (const [midiNote, count] of this.playbackNotes) {
        for (let index = 0; index < count; index += 1) this.api.pianoNoteOff(midiNote);
      }
    }
    this.playbackNotes.clear();
    this.playing = false;
  }

  finishPlayback() {
    this.timers.clear();
    this.playbackNotes.clear();
    this.playing = false;
  }

  clear() {
    this.stopRecording();
    this.stopPlayback();
    this.events = [];
  }

  getEvents() {
    return this.events.map((event) => ({ ...event }));
  }

  toJSON() {
    return JSON.stringify({
      version: RECORDING_FILE_VERSION,
      events: this.getEvents(),
    }, null, 2);
  }

  loadJSON(json) {
    const { events } = parseRecordingFile(json);
    this.stopRecording();
    this.stopPlayback();
    this.events = events;
    return this.getEvents();
  }

  loadEvents(events) {
    const json = JSON.stringify({ version: RECORDING_FILE_VERSION, events });
    return this.loadJSON(json);
  }
}
