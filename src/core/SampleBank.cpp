#include "SampleBank.h"

#include "MidiInstrumentEngine.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <limits>

namespace
{
constexpr double pi = 3.14159265358979323846;

std::int32_t readI32(const unsigned char* bytes)
{
    return static_cast<std::int32_t>(bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24));
}

std::int16_t readI16(const unsigned char* bytes)
{
    return static_cast<std::int16_t>(bytes[0] | (bytes[1] << 8));
}

int rootFromFilename(const std::filesystem::path& path, int fallback)
{
    const auto stem = path.stem().string();
    std::string digits;
    for (const auto ch : stem)
    {
        if (ch >= '0' && ch <= '9')
            digits.push_back(ch);
    }

    if (digits.empty())
        return fallback;

    return std::clamp(std::stoi(digits), 0, 127);
}

bool loadWavMono(const std::filesystem::path& path, SampleData& output, int fallbackRoot)
{
    std::ifstream file(path, std::ios::binary);
    if (!file)
        return false;

    std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(file)), {});
    if (bytes.size() < 44 || std::string(reinterpret_cast<const char*>(bytes.data()), 4) != "RIFF"
        || std::string(reinterpret_cast<const char*>(bytes.data() + 8), 4) != "WAVE")
        return false;

    std::uint16_t channels = 0;
    std::uint32_t sampleRate = 44100;
    std::uint16_t bitsPerSample = 0;
    std::uint16_t audioFormat = 0;
    const unsigned char* data = nullptr;
    std::uint32_t dataSize = 0;

    std::size_t offset = 12;
    while (offset + 8 <= bytes.size())
    {
        const auto* chunk = bytes.data() + offset;
        const auto id = std::string(reinterpret_cast<const char*>(chunk), 4);
        const auto size = static_cast<std::uint32_t>(readI32(chunk + 4));
        offset += 8;

        if (offset + size > bytes.size())
            break;

        if (id == "fmt " && size >= 16)
        {
            audioFormat = static_cast<std::uint16_t>(readI16(bytes.data() + offset));
            channels = static_cast<std::uint16_t>(readI16(bytes.data() + offset + 2));
            sampleRate = static_cast<std::uint32_t>(readI32(bytes.data() + offset + 4));
            bitsPerSample = static_cast<std::uint16_t>(readI16(bytes.data() + offset + 14));
        }
        else if (id == "data")
        {
            data = bytes.data() + offset;
            dataSize = size;
        }

        offset += size + (size % 2);
    }

    if (data == nullptr || channels == 0 || audioFormat != 1 || bitsPerSample != 16)
        return false;

    const auto bytesPerFrame = static_cast<std::size_t>(channels) * sizeof(std::int16_t);
    const auto frameCount = dataSize / bytesPerFrame;
    output.mono.assign(frameCount, 0.0f);

    for (std::size_t frame = 0; frame < frameCount; ++frame)
    {
        int sum = 0;
        for (std::size_t channel = 0; channel < channels; ++channel)
        {
            const auto* sampleBytes = data + frame * bytesPerFrame + channel * sizeof(std::int16_t);
            sum += readI16(sampleBytes);
        }
        output.mono[frame] = static_cast<float>(sum) / static_cast<float>(channels * std::numeric_limits<std::int16_t>::max());
    }

    output.rootMidiNote = rootFromFilename(path, fallbackRoot);
    output.sourceSampleRate = sampleRate;
    return !output.mono.empty();
}

SampleData makeDecayingTone(double sampleRate, double frequency, float durationSeconds, float brightness)
{
    SampleData sample;
    sample.rootMidiNote = 60;
    sample.sourceSampleRate = sampleRate;
    sample.mono.resize(static_cast<std::size_t>(sampleRate * durationSeconds));

    for (std::size_t i = 0; i < sample.mono.size(); ++i)
    {
        const auto t = static_cast<double>(i) / sampleRate;
        const auto env = std::exp(-t * 3.0);
        const auto base = std::sin(2.0 * pi * frequency * t);
        const auto harmonic = std::sin(2.0 * pi * frequency * 2.0 * t) * brightness;
        sample.mono[i] = static_cast<float>((base + harmonic) * env);
    }

    return sample;
}

SampleData makeDrum(double sampleRate, double frequency, float durationSeconds)
{
    SampleData sample;
    sample.rootMidiNote = 36;
    sample.sourceSampleRate = sampleRate;
    sample.mono.resize(static_cast<std::size_t>(sampleRate * durationSeconds));

    std::uint32_t seed = 22222;
    for (std::size_t i = 0; i < sample.mono.size(); ++i)
    {
        seed = seed * 1664525u + 1013904223u;
        const auto noise = (static_cast<float>((seed >> 16) & 0xffffu) / 32768.0f) - 1.0f;
        const auto t = static_cast<double>(i) / sampleRate;
        const auto env = std::exp(-t * 18.0);
        sample.mono[i] = static_cast<float>((std::sin(2.0 * pi * frequency * t) * 0.7 + noise * 0.3) * env);
    }

    return sample;
}
}

bool SampleBank::loadFromDirectory(const std::filesystem::path& directory)
{
    if (!std::filesystem::exists(directory))
        return false;

    std::vector<SampleData> loaded;
    for (const auto& entry : std::filesystem::directory_iterator(directory))
    {
        if (!entry.is_regular_file() || entry.path().extension() != ".wav")
            continue;

        SampleData sample;
        if (loadWavMono(entry.path(), sample, percussion ? 36 : 60))
            loaded.push_back(std::move(sample));
    }

    if (loaded.empty())
        return false;

    samples = std::move(loaded);
    return true;
}

void SampleBank::makeDefault(InstrumentType instrument, double sampleRate)
{
    samples.clear();
    percussion = instrument == InstrumentType::Drum;

    if (instrument == InstrumentType::Piano)
    {
        samples.push_back(makeDecayingTone(sampleRate, 261.6256, 2.0f, 0.22f));
        samples.back().rootMidiNote = 60;
    }
    else if (instrument == InstrumentType::Guitar)
    {
        samples.push_back(makeDecayingTone(sampleRate, 196.0, 1.3f, 0.48f));
        samples.back().rootMidiNote = 55;
    }
    else
    {
        samples.push_back(makeDrum(sampleRate, 58.0, 0.6f));
        samples.back().rootMidiNote = 36;
        samples.push_back(makeDrum(sampleRate, 180.0, 0.35f));
        samples.back().rootMidiNote = 38;
        samples.push_back(makeDrum(sampleRate, 6200.0, 0.18f));
        samples.back().rootMidiNote = 42;
    }
}

const SampleData* SampleBank::findSampleForMidiNote(int midiNote) const
{
    if (samples.empty())
        return nullptr;

    if (percussion)
    {
        auto exact = std::find_if(samples.begin(), samples.end(), [midiNote](const SampleData& sample) {
            return sample.rootMidiNote == midiNote;
        });
        return exact != samples.end() ? &*exact : &samples.front();
    }

    auto best = samples.begin();
    auto bestDistance = std::abs(best->rootMidiNote - midiNote);
    for (auto it = samples.begin() + 1; it != samples.end(); ++it)
    {
        const auto distance = std::abs(it->rootMidiNote - midiNote);
        if (distance < bestDistance)
        {
            best = it;
            bestDistance = distance;
        }
    }

    return &*best;
}
