import { MidiApi } from "./midi-api.js";
import { createPianoKeyboard } from "./piano-keyboard.js";

let audioContext;
let api;
let processor;

const startButton = document.querySelector("#start");
const statusText = document.querySelector("#status");
const instrumentSelect = document.querySelector("#instrument");
const pianoKeyboard = document.querySelector("#piano-keyboard");

createPianoKeyboard(pianoKeyboard, () => api);

startButton.addEventListener("click", async () => {
  audioContext = new AudioContext();
  api = await MidiApi.create({
    sampleRate: audioContext.sampleRate,
    blockSize: 512,
  });

  processor = audioContext.createScriptProcessor(512, 0, 2);
  processor.onaudioprocess = (event) => {
    const rendered = api.render();
    event.outputBuffer.getChannelData(0).set(rendered.left);
    event.outputBuffer.getChannelData(1).set(rendered.right);
  };
  processor.connect(audioContext.destination);

  api.setInstrument(instrumentSelect.value);
  instrumentSelect.value = "piano";
  instrumentSelect.disabled = true;
  startButton.disabled = true;
  statusText.textContent = "준비 완료";
});
