#pragma once

#include <array>
#include <string_view>

struct PianoNote
{
    int midiNumber;
    std::string_view name;
    int octave;
    bool isWhiteKey;
};

namespace PianoNotes
{
constexpr int lowestMidiNote = 21;
constexpr int highestMidiNote = 108;
constexpr int keyCount = highestMidiNote - lowestMidiNote + 1;

const std::array<PianoNote, keyCount>& all() noexcept;
const PianoNote* find(int midiNumber) noexcept;
bool contains(int midiNumber) noexcept;
}
