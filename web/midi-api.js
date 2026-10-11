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
    this.leftPtr = module._malloc(blockSize * Float32Array.BYTES_PER_ELEMENT);
    this.rightPtr = module._malloc(blockSize * Float32Array.BYTES_PER_ELEMENT);
  }

  prepare() {
    this.module._midi_prepare(this.sampleRate, this.blockSize);
  }

  setInstrument(name) {
    const id = name === "drums" || name === "drum" ? 1 : name === "guitar" ? 2 : 0;
    this.module._midi_set_instrument(id);
  }

  noteOn(midiNote, velocity = 0.8) {
    this.module._midi_note_on(midiNote, velocity);
  }

  noteOff(midiNote) {
    this.module._midi_note_off(midiNote);
  }

  allNotesOff() {
    this.module._midi_all_notes_off();
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
