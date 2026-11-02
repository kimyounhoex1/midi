#include "PianoNotes.h"

#include <cstddef>

namespace
{
constexpr std::array<std::string_view, 12> noteNames {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
};

constexpr std::array<bool, 12> whiteKeys {
    true, false, true, false, true, true, false, true, false, true, false, true
};

constexpr std::array<PianoNote, PianoNotes::keyCount> makePianoNotes()
{
    std::array<PianoNote, PianoNotes::keyCount> notes {};
    for (int midi = PianoNotes::lowestMidiNote; midi <= PianoNotes::highestMidiNote; ++midi)
    {
        const auto pitchClass = static_cast<std::size_t>(midi % 12);
        notes[static_cast<std::size_t>(midi - PianoNotes::lowestMidiNote)] = {
            midi, noteNames[pitchClass], midi / 12 - 1, whiteKeys[pitchClass]
        };
    }
    return notes;
}

constexpr auto pianoNotes = makePianoNotes();
}

const std::array<PianoNote, PianoNotes::keyCount>& PianoNotes::all() noexcept
{
    return pianoNotes;
}

const PianoNote* PianoNotes::find(int midiNumber) noexcept
{
    if (!contains(midiNumber))
        return nullptr;

    return &pianoNotes[static_cast<std::size_t>(midiNumber - lowestMidiNote)];
}

bool PianoNotes::contains(int midiNumber) noexcept
{
    return midiNumber >= lowestMidiNote && midiNumber <= highestMidiNote;
}
