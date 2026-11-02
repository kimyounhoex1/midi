const NOTE_NAMES = Object.freeze(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);

const CHORD_NAMES = Object.freeze([
  { intervals: "0,4,7,11", name: "maj7" },
  { intervals: "0,4,7,10", name: "7" },
  { intervals: "0,3,7,10", name: "min7" },
  { intervals: "0,4,7", name: "maj" },
  { intervals: "0,3,7", name: "min" },
  { intervals: "0,3,6", name: "dim" },
  { intervals: "0,4,8", name: "aug" },
]);

export function midiNoteName(midiNote) {
  return `${NOTE_NAMES[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
}

export function eventsToPianoRoll(events) {
  const active = new Map();
  const notes = [];
  let duration = 0;
  for (const event of events) {
    duration = Math.max(duration, event.elapsedTime);
    const queue = active.get(event.midiNote) ?? [];
    if (event.type === "note-on") {
      queue.push(event);
      active.set(event.midiNote, queue);
    } else if (queue.length) {
      const start = queue.shift();
      notes.push({
        midiNote: event.midiNote,
        name: midiNoteName(event.midiNote),
        start: start.elapsedTime,
        duration: Math.max(1, event.elapsedTime - start.elapsedTime),
        velocity: start.velocity,
      });
      if (!queue.length) active.delete(event.midiNote);
    }
  }
  for (const queue of active.values()) {
    for (const start of queue) {
      notes.push({
        midiNote: start.midiNote,
        name: midiNoteName(start.midiNote),
        start: start.elapsedTime,
        duration: Math.max(1, duration - start.elapsedTime),
        velocity: start.velocity,
      });
    }
  }
  notes.sort((a, b) => a.start - b.start || a.midiNote - b.midiNote);
  return { notes, duration };
}

export function detectChords(notes) {
  const groups = new Map();
  for (const note of notes) {
    const group = groups.get(note.start) ?? [];
    group.push(note.midiNote);
    groups.set(note.start, group);
  }
  const chords = [];
  for (const [start, midiNotes] of groups) {
    const sorted = [...new Set(midiNotes)].sort((a, b) => a - b);
    if (sorted.length < 3) continue;
    const root = sorted[0];
    const intervals = sorted.map((note) => note - root).join(",");
    const match = CHORD_NAMES.find((candidate) => candidate.intervals === intervals);
    if (match) chords.push({ start, name: `${NOTE_NAMES[root % 12]} ${match.name}` });
  }
  return chords;
}

export class RecordingLibrary {
  constructor() {
    this.recordings = new Map();
    this.nextId = 1;
  }

  save(events) {
    const id = this.nextId++;
    this.recordings.set(id, events.map((event) => ({ ...event })));
    return id;
  }

  get(id) {
    const events = this.recordings.get(id);
    return events?.map((event) => ({ ...event }));
  }

  entries() {
    return [...this.recordings].map(([id, events]) => [id, events.map((event) => ({ ...event }))]);
  }
}
