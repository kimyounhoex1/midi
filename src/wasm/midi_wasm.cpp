#include "MidiInstrumentEngine.h"

namespace
{
MidiInstrumentEngine engine;
}

extern "C"
{
void midi_prepare(double sampleRate, int blockSize)
{
    engine.prepare(sampleRate, blockSize);
}

void midi_set_instrument(int instrument)
{
    if (instrument == 1)
        engine.setInstrument(InstrumentType::Drum);
    else if (instrument == 2)
        engine.setInstrument(InstrumentType::Guitar);
    else
        engine.setInstrument(InstrumentType::Piano);
}

void midi_note_on(int midiNote, float velocity)
{
    engine.noteOn(midiNote, velocity);
}

void midi_note_off(int midiNote)
{
    engine.noteOff(midiNote);
}

void midi_render(float* left, float* right, int numFrames)
{
    engine.render(left, right, numFrames);
}

void midi_all_notes_off()
{
    engine.allNotesOff();
}
}
