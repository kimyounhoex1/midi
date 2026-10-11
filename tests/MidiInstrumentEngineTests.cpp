#include "MidiInstrumentEngine.h"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <iostream>
#include <vector>

namespace
{
bool hasSignal(const std::vector<float>& buffer)
{
    return std::any_of(buffer.begin(), buffer.end(), [](float value) {
        return std::abs(value) > 0.00001f;
    });
}

void testInstrumentProducesAudio(InstrumentType instrument, int note)
{
    MidiInstrumentEngine engine;
    engine.prepare(44100.0, 128);
    engine.setInstrument(instrument);
    engine.noteOn(note, 1.0f);

    std::vector<float> left(512);
    std::vector<float> right(512);
    engine.render(left.data(), right.data(), static_cast<int>(left.size()));

    assert(hasSignal(left));
    assert(hasSignal(right));
}
}

int main()
{
    testInstrumentProducesAudio(InstrumentType::Piano, 60);
    testInstrumentProducesAudio(InstrumentType::Drum, 36);
    testInstrumentProducesAudio(InstrumentType::Guitar, 55);

    MidiInstrumentEngine engine;
    engine.prepare(44100.0, 128);
    engine.noteOn(60, 1.0f);
    engine.noteOff(60);
    engine.allNotesOff();

    std::cout << "midi_core_tests passed\n";
    return 0;
}
