#include "MidiInstrumentEngine.h"
#include "PianoNotes.h"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <string_view>
#include <vector>

namespace
{
bool hasSignal(const std::vector<float>& buffer)
{
    return std::any_of(buffer.begin(), buffer.end(), [](float value) {
        return std::abs(value) > 0.00001f;
    });
}

float rootMeanSquare(const std::vector<float>& buffer)
{
    float sumOfSquares = 0.0f;
    for (const auto value : buffer)
        sumOfSquares += value * value;

    return std::sqrt(sumOfSquares / static_cast<float>(buffer.size()));
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

void testNoteOffReducesVolume()
{
    MidiInstrumentEngine engine;
    engine.prepare(44100.0, 128);
    engine.noteOn(60, 1.0f);

    std::vector<float> left(256);
    std::vector<float> right(256);

    engine.render(left.data(), right.data(), static_cast<int>(left.size()));
    engine.render(left.data(), right.data(), static_cast<int>(left.size()));
    const auto volumeBeforeNoteOff = rootMeanSquare(left);

    engine.noteOff(60);
    engine.render(left.data(), right.data(), static_cast<int>(left.size()));
    const auto volumeAfterNoteOff = rootMeanSquare(left);

    assert(volumeBeforeNoteOff > 0.0f);
    assert(volumeAfterNoteOff < volumeBeforeNoteOff);

    engine.render(left.data(), right.data(), static_cast<int>(left.size()));
    engine.render(left.data(), right.data(), static_cast<int>(left.size()));
    engine.render(left.data(), right.data(), static_cast<int>(left.size()));
    assert(!hasSignal(left));
    assert(!hasSignal(right));
}

void testPianoNoteDefinitions()
{
    const auto& notes = PianoNotes::all();
    assert(notes.size() == 88);
    assert(notes.front().midiNumber == 21);
    assert(notes.front().name == std::string_view("A"));
    assert(notes.front().octave == 0);
    assert(notes.back().midiNumber == 108);
    assert(notes.back().name == std::string_view("C"));
    assert(notes.back().octave == 8);

    int whiteKeyCount = 0;
    int blackKeyCount = 0;
    constexpr std::array<std::string_view, 12> expectedNames {
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
    };
    for (std::size_t index = 0; index < notes.size(); ++index)
    {
        assert(notes[index].midiNumber == PianoNotes::lowestMidiNote + static_cast<int>(index));
        assert(notes[index].name == expectedNames[static_cast<std::size_t>(notes[index].midiNumber % 12)]);
        assert(notes[index].octave == notes[index].midiNumber / 12 - 1);
        if (notes[index].isWhiteKey)
            ++whiteKeyCount;
        else
            ++blackKeyCount;
    }

    assert(whiteKeyCount == 52);
    assert(blackKeyCount == 36);
    assert(PianoNotes::find(21) == &notes.front());
    assert(PianoNotes::find(108) == &notes.back());
    assert(PianoNotes::find(20) == nullptr);
    assert(PianoNotes::find(109) == nullptr);
}

void testAllPianoNotesPlayAndStop()
{
    MidiInstrumentEngine engine;
    engine.prepare(44100.0, 128);

    for (const auto& note : PianoNotes::all())
    {
        engine.noteOn(note.midiNumber, 1.0f);

        std::vector<float> left(512);
        std::vector<float> right(512);
        engine.render(left.data(), right.data(), static_cast<int>(left.size()));
        assert(hasSignal(left));

        engine.noteOff(note.midiNumber);
        engine.render(left.data(), right.data(), static_cast<int>(left.size()));
        engine.render(left.data(), right.data(), static_cast<int>(left.size()));
        engine.render(left.data(), right.data(), static_cast<int>(left.size()));
        assert(!hasSignal(left));
        assert(!hasSignal(right));
    }
}

void testPianoRejectsInvalidInputs()
{
    for (const auto midiNote : { 20, 109, -1, 128 })
    {
        MidiInstrumentEngine engine;
        engine.prepare(44100.0, 128);
        engine.noteOn(midiNote, 1.0f);

        std::vector<float> left(256);
        std::vector<float> right(256);
        engine.render(left.data(), right.data(), static_cast<int>(left.size()));
        assert(!hasSignal(left));
        assert(!hasSignal(right));
        engine.noteOff(midiNote);
    }

    MidiInstrumentEngine engine;
    engine.prepare(44100.0, 128);
    engine.noteOn(60, std::numeric_limits<float>::quiet_NaN());
    std::vector<float> left(256);
    std::vector<float> right(256);
    engine.render(left.data(), right.data(), static_cast<int>(left.size()));
    assert(!hasSignal(left));
    assert(!hasSignal(right));
}
}

int main()
{
    testInstrumentProducesAudio(InstrumentType::Piano, 60);
    testInstrumentProducesAudio(InstrumentType::Drum, 36);
    testInstrumentProducesAudio(InstrumentType::Guitar, 55);
    testNoteOffReducesVolume();
    testPianoNoteDefinitions();
    testAllPianoNotesPlayAndStop();
    testPianoRejectsInvalidInputs();

    MidiInstrumentEngine engine;
    engine.prepare(44100.0, 128);
    engine.noteOn(60, 1.0f);
    engine.noteOff(60);
    engine.allNotesOff();

    std::cout << "midi_core_tests passed\n";
    return 0;
}
