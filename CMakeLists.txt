cmake_minimum_required(VERSION 3.22)

project(MidiInstrumentApi VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(MIDI_BUILD_APP "Build the JUCE desktop application" ON)
option(MIDI_BUILD_TESTS "Build core engine tests" ON)
option(MIDI_FETCH_JUCE "Download JUCE with FetchContent when building the app" ON)

add_library(midi_core
    src/core/MidiInstrumentEngine.cpp
    src/core/SampleBank.cpp
)

target_include_directories(midi_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/src/core
)

if(MIDI_BUILD_TESTS)
    add_executable(midi_core_tests tests/MidiInstrumentEngineTests.cpp)
    target_link_libraries(midi_core_tests PRIVATE midi_core)
    enable_testing()
    add_test(NAME midi_core_tests COMMAND midi_core_tests)
endif()

if(EMSCRIPTEN)
    add_executable(midi_wasm src/wasm/midi_wasm.cpp)
    target_link_libraries(midi_wasm PRIVATE midi_core)
    target_link_options(midi_wasm PRIVATE
        "-sMODULARIZE=1"
        "-sEXPORT_NAME=createMidiModule"
        "-sENVIRONMENT=web,worker"
        "-sEXPORTED_FUNCTIONS=['_midi_prepare','_midi_set_instrument','_midi_note_on','_midi_note_off','_midi_render','_midi_all_notes_off','_malloc','_free']"
        "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32']"
        "-sALLOW_MEMORY_GROWTH=1"
    )
    set_target_properties(midi_wasm PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/web/dist
        OUTPUT_NAME "midi_wasm"
        SUFFIX ".js"
    )
endif()

if(MIDI_BUILD_APP AND NOT EMSCRIPTEN)
    include(FetchContent)

    if(MIDI_FETCH_JUCE)
        FetchContent_Declare(
            JUCE
            GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
            GIT_TAG 8.0.10
        )
        FetchContent_MakeAvailable(JUCE)
    endif()

    juce_add_gui_app(MidiInstrumentApp
        PRODUCT_NAME "MIDI Instrument API"
        COMPANY_NAME "MIDIStudy"
        BUNDLE_ID "com.midistudy.MidiInstrumentApp"
        VERSION ${PROJECT_VERSION}
    )

    target_sources(MidiInstrumentApp PRIVATE src/app/Main.cpp)
    target_link_libraries(MidiInstrumentApp
        PRIVATE
            midi_core
            juce::juce_audio_utils
            juce::juce_gui_extra
        PUBLIC
            juce::juce_recommended_config_flags
            juce::juce_recommended_lto_flags
            juce::juce_recommended_warning_flags
    )

    target_compile_definitions(MidiInstrumentApp PRIVATE
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
    )
endif()
