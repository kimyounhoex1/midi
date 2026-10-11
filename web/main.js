import { MidiApi } from "./midi-api.js";

let audioContext;
let api;
let processor;

const startButton = document.querySelector("#start");
const statusText = document.querySelector("#status");
const instrumentSelect = document.querySelector("#instrument");

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
  startButton.disabled = true;
  statusText.textContent = "준비 완료";
});

instrumentSelect.addEventListener("change", () => {
  api?.setInstrument(instrumentSelect.value);
});

document.querySelectorAll("[data-note]").forEach((button) => {
  button.addEventListener("pointerdown", () => {
    api?.noteOn(Number(button.dataset.note), 0.9);
  });

  button.addEventListener("pointerup", () => {
    api?.noteOff(Number(button.dataset.note));
  });

  button.addEventListener("pointerleave", () => {
    api?.noteOff(Number(button.dataset.note));
  });
});
