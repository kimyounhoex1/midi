#pragma once

#include <filesystem>
#include <string>
#include <vector>

enum class InstrumentType;

struct SampleData
{
    std::vector<float> mono;
    int rootMidiNote = 60;
    double sourceSampleRate = 44100.0;
};

class SampleBank
{
public:
    bool loadFromDirectory(const std::filesystem::path& directory);
    void makeDefault(InstrumentType instrument, double sampleRate);

    const SampleData* findSampleForMidiNote(int midiNote) const;
    bool isPercussion() const noexcept { return percussion; }

private:
    std::vector<SampleData> samples;
    bool percussion = false;
};
