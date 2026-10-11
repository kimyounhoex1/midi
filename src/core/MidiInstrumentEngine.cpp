#include "MidiInstrumentEngine.h"

#include <algorithm>
#include <cmath>
#include <filesystem>

namespace
{
constexpr int maxVoices = 32;
constexpr float attackStep = 0.004f;
constexpr float releaseStep = 0.0015f;

int instrumentIndex(InstrumentType instrument)
{
    return static_cast<int>(instrument);
}
}

void MidiInstrumentEngine::prepare(double newSampleRate, int newBlockSize)
{
    sampleRate = newSampleRate > 0.0 ? newSampleRate : 44100.0;
    blockSize = newBlockSize > 0 ? newBlockSize : 512;
    voices.assign(maxVoices, {});

    banks[instrumentIndex(InstrumentType::Piano)].makeDefault(InstrumentType::Piano, sampleRate);
    banks[instrumentIndex(InstrumentType::Drum)].makeDefault(InstrumentType::Drum, sampleRate);
    banks[instrumentIndex(InstrumentType::Guitar)].makeDefault(InstrumentType::Guitar, sampleRate);
}

bool MidiInstrumentEngine::loadSamplesFromDirectory(const std::string& samplesRoot)
{
    namespace fs = std::filesystem;

    bool loadedAny = false;
    loadedAny = banks[instrumentIndex(InstrumentType::Piano)].loadFromDirectory(fs::path(samplesRoot) / "piano") || loadedAny;
    loadedAny = banks[instrumentIndex(InstrumentType::Drum)].loadFromDirectory(fs::path(samplesRoot) / "drums") || loadedAny;
    loadedAny = banks[instrumentIndex(InstrumentType::Guitar)].loadFromDirectory(fs::path(samplesRoot) / "guitar") || loadedAny;
    return loadedAny;
}

void MidiInstrumentEngine::setInstrument(InstrumentType newInstrument)
{
    instrument = newInstrument;
    allNotesOff();
}

void MidiInstrumentEngine::noteOn(int midiNote, float velocity)
{
    const auto* sample = currentBank().findSampleForMidiNote(midiNote);
    if (sample == nullptr)
        return;

    auto& voice = allocateVoice();
    voice.sample = sample;
    voice.midiNote = midiNote;
    voice.velocity = clampVelocity(velocity);
    voice.position = 0.0;
    voice.gain = 0.0f;
    voice.releasing = false;
    voice.active = true;

    if (currentBank().isPercussion())
        voice.increment = sample->sourceSampleRate / sampleRate;
    else
        voice.increment = (sample->sourceSampleRate / sampleRate) * std::pow(2.0, (midiNote - sample->rootMidiNote) / 12.0);
}

void MidiInstrumentEngine::noteOff(int midiNote)
{
    for (auto& voice : voices)
    {
        if (voice.active && voice.midiNote == midiNote)
            voice.releasing = true;
    }
}

void MidiInstrumentEngine::render(float* left, float* right, int numFrames)
{
    if (left == nullptr || right == nullptr || numFrames <= 0)
        return;

    std::fill(left, left + numFrames, 0.0f);
    std::fill(right, right + numFrames, 0.0f);

    for (auto& voice : voices)
    {
        if (!voice.active || voice.sample == nullptr || voice.sample->mono.empty())
            continue;

        const auto& data = voice.sample->mono;

        for (int frame = 0; frame < numFrames; ++frame)
        {
            const auto index = static_cast<std::size_t>(voice.position);
            if (index + 1 >= data.size())
            {
                voice.active = false;
                break;
            }

            const auto fraction = static_cast<float>(voice.position - static_cast<double>(index));
            const auto value = data[index] + (data[index + 1] - data[index]) * fraction;

            voice.gain += voice.releasing ? -releaseStep : attackStep;
            voice.gain = std::clamp(voice.gain, 0.0f, 1.0f);

            const auto output = value * voice.velocity * voice.gain * 0.35f;
            left[frame] += output;
            right[frame] += output;

            voice.position += voice.increment;

            if (voice.releasing && voice.gain <= 0.0f)
            {
                voice.active = false;
                break;
            }
        }
    }
}

void MidiInstrumentEngine::allNotesOff()
{
    for (auto& voice : voices)
        voice.releasing = true;
}

SampleBank& MidiInstrumentEngine::currentBank()
{
    return banks[instrumentIndex(instrument)];
}

const SampleBank& MidiInstrumentEngine::currentBank() const
{
    return banks[instrumentIndex(instrument)];
}

MidiInstrumentEngine::Voice& MidiInstrumentEngine::allocateVoice()
{
    auto inactive = std::find_if(voices.begin(), voices.end(), [](const Voice& voice) { return !voice.active; });
    if (inactive != voices.end())
        return *inactive;

    return voices.front();
}

float MidiInstrumentEngine::clampVelocity(float velocity)
{
    return std::clamp(velocity, 0.0f, 1.0f);
}
