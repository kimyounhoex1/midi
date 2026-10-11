#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_gui_extra/juce_gui_extra.h>

#include "MidiInstrumentEngine.h"

class MainComponent final : public juce::AudioAppComponent {
 public:
  MainComponent() {
    addAndMakeVisible(instrumentBox);
    instrumentBox.addItem("Piano", 1);
    instrumentBox.addItem("Drums", 2);
    instrumentBox.addItem("Guitar", 3);
    instrumentBox.addItem("Base", 4);
    instrumentBox.setSelectedId(1);
    instrumentBox.onChange = [this] {
      const auto id = instrumentBox.getSelectedId();
      engine.setInstrument(: id == 1 ? InstrumentType::Piano
                           : id == 2 ? InstrumentType::Drum
                           : id == 3 ? InstrumentType::Guitar
                           : id == 4 ? InstrumentType::Base);
    };

    addButton(pianoButton, "C4", 60);
    addButton(drumButton, "Kick", 36);
    addButton(guitarButton, "G3", 55);

    setSize(420, 160);
    setAudioChannels(0, 2);
  }

  ~MainComponent() override { shutdownAudio(); }

  void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override {
    engine.prepare(sampleRate, samplesPerBlockExpected);
    engine.loadSamplesFromDirectory("assets/samples");
  }

  void getNextAudioBlock(
      const juce::AudioSourceChannelInfo& bufferToFill) override {
    auto* left =
        bufferToFill.buffer->getWritePointer(0, bufferToFill.startSample);
    auto* right =
        bufferToFill.buffer->getNumChannels() > 1
            ? bufferToFill.buffer->getWritePointer(1, bufferToFill.startSample)
            : left;

    engine.render(left, right, bufferToFill.numSamples);
  }

  void releaseResources() override {}

  void resized() override {
    auto area = getLocalBounds().reduced(16);
    instrumentBox.setBounds(area.removeFromTop(32));
    area.removeFromTop(16);

    auto row = area.removeFromTop(44);
    pianoButton.setBounds(row.removeFromLeft(120));
    row.removeFromLeft(12);
    drumButton.setBounds(row.removeFromLeft(120));
    row.removeFromLeft(12);
    guitarButton.setBounds(row.removeFromLeft(120));
  }

 private:
  void addButton(juce::TextButton& button, const juce::String& label,
                 int midiNote) {
    addAndMakeVisible(button);
    button.setButtonText(label);
    button.onClick = [this, midiNote] { engine.noteOn(midiNote, 0.9f); };
  }

  MidiInstrumentEngine engine;
  juce::ComboBox instrumentBox;
  juce::TextButton pianoButton;
  juce::TextButton drumButton;
  juce::TextButton guitarButton;
};

class MidiInstrumentApplication final : public juce::JUCEApplication {
 public:
  const juce::String getApplicationName() override {
    return "MIDI Instrument API";
  }
  const juce::String getApplicationVersion() override { return "0.1.0"; }

  void initialise(const juce::String&) override {
    mainWindow = std::make_unique<MainWindow>(getApplicationName());
  }

  void shutdown() override { mainWindow = nullptr; }

 private:
  class MainWindow final : public juce::DocumentWindow {
   public:
    explicit MainWindow(juce::String name)
        : DocumentWindow(std::move(name), juce::Colours::darkslategrey,
                         DocumentWindow::allButtons) {
      setUsingNativeTitleBar(true);
      setContentOwned(new MainComponent(), true);
      centreWithSize(getWidth(), getHeight());
      setVisible(true);
    }

    void closeButtonPressed() override {
      juce::JUCEApplication::getInstance()->systemRequestedQuit();
    }
  };

  std::unique_ptr<MainWindow> mainWindow;
};

START_JUCE_APPLICATION(MidiInstrumentApplication)
