#pragma once

#include <array>
#include <string>
#include <vector>

#include "SampleBank.h"

enum class InstrumentType { Piano = 0, Drum = 1, Guitar = 2, Base = 3 };

class MidiInstrumentEngine {
 public:
  void prepare(double newSampleRate, int newBlockSize);
  bool loadSamplesFromDirectory(const std::string& samplesRoot);

  void setInstrument(InstrumentType newInstrument);
  InstrumentType getInstrument() const noexcept { return instrument; }

  void noteOn(int midiNote, float velocity);
  void noteOff(int midiNote);
  void render(float* left, float* right, int numFrames);
  void allNotesOff();

 private:
  struct Voice {
    const SampleData* sample = nullptr;
    int midiNote = 60;
    float velocity = 0.0f;
    double position = 0.0;
    double increment = 1.0;
    float gain = 0.0f;
    bool releasing = false;
    bool active = false;
  };

  SampleBank& currentBank();
  const SampleBank& currentBank() const;
  Voice& allocateVoice();
  static float clampVelocity(float velocity);

  std::array<SampleBank, 4> banks;
  std::vector<Voice> voices;
  InstrumentType instrument = InstrumentType::Piano;
  double sampleRate = 44100.0;
  int blockSize = 512;
};
