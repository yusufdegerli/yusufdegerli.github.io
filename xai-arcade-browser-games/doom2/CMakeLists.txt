cmake_minimum_required(VERSION 3.16)

project(Doom64Clone
    VERSION 0.1.0
    DESCRIPTION "Doom 64-inspired game clone"
    LANGUAGES CXX
)

# ---------------------------------------------------------------------------
# Language / toolchain
# ---------------------------------------------------------------------------
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------
option(DOOM_BUILD_SHARED "Build as shared library" OFF)

# ---------------------------------------------------------------------------
# Dependencies — Raylib (window, rendering, audio, input)
# Prefer a system install; fall back to FetchContent.
# ---------------------------------------------------------------------------
set(RAYLIB_VERSION 5.5)

find_package(raylib ${RAYLIB_VERSION} QUIET)

if(NOT raylib_FOUND)
    include(FetchContent)

    set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(BUILD_GAMES    OFF CACHE BOOL "" FORCE)

    FetchContent_Declare(
        raylib
        GIT_REPOSITORY https://github.com/raysan5/raylib.git
        GIT_TAG        ${RAYLIB_VERSION}
        GIT_SHALLOW    TRUE
    )
    FetchContent_MakeAvailable(raylib)
endif()

# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------
set(DOOM_SOURCES
    src/main.cpp
    src/Game.cpp
    src/Map.cpp
    src/Player.cpp
    src/Enemy.cpp
    src/Portal.cpp
    src/Raycaster.cpp
    src/TextureStore.cpp
)

set(DOOM_HEADERS
    include/Game.hpp
    include/Map.hpp
    include/Player.hpp
    include/Enemy.hpp
    include/Portal.hpp
    include/Raycaster.hpp
    include/TextureStore.hpp
)

add_executable(${PROJECT_NAME}
    ${DOOM_SOURCES}
    ${DOOM_HEADERS}
)

target_include_directories(${PROJECT_NAME}
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(${PROJECT_NAME}
    PRIVATE
        raylib
)

# ---------------------------------------------------------------------------
# Platform-specific linkage
# ---------------------------------------------------------------------------
if(APPLE)
    target_link_libraries(${PROJECT_NAME}
        PRIVATE
            "-framework IOKit"
            "-framework Cocoa"
            "-framework OpenGL"
    )
elseif(UNIX AND NOT APPLE)
    # Linux: raylib typically needs these when built statically
    find_package(Threads REQUIRED)
    target_link_libraries(${PROJECT_NAME}
        PRIVATE
            Threads::Threads
            m
            dl
    )
elseif(WIN32)
    target_link_libraries(${PROJECT_NAME}
        PRIVATE
            winmm
            gdi32
    )
endif()

# ---------------------------------------------------------------------------
# Warnings
# ---------------------------------------------------------------------------
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /W4)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Wconversion
        -Wshadow
    )
endif()

# ---------------------------------------------------------------------------
# Output layout
# ---------------------------------------------------------------------------
set_target_properties(${PROJECT_NAME} PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)

# Copy maps/ and assets/ next to the binary for runtime loading.
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_SOURCE_DIR}/maps"
        "$<TARGET_FILE_DIR:${PROJECT_NAME}>/maps"
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_SOURCE_DIR}/assets"
        "$<TARGET_FILE_DIR:${PROJECT_NAME}>/assets"
    COMMENT "Copying maps/ and assets/ to output directory"
)

message(STATUS "=== ${PROJECT_NAME} v${PROJECT_VERSION} ===")
message(STATUS "C++ standard : C++${CMAKE_CXX_STANDARD}")
message(STATUS "Build type   : ${CMAKE_BUILD_TYPE}")
