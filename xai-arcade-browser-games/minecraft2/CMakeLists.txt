cmake_minimum_required(VERSION 3.20)
project(Minecraft2 VERSION 0.3.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_C_STANDARD 11)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(APPLE AND NOT CMAKE_OSX_ARCHITECTURES)
    set(CMAKE_OSX_ARCHITECTURES "arm64" CACHE STRING "" FORCE)
endif()
if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|AppleClang|GNU")
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()
if(APPLE AND EXISTS "/opt/homebrew")
    list(PREPEND CMAKE_PREFIX_PATH "/opt/homebrew")
endif()

find_package(OpenGL REQUIRED)
find_package(glfw3 3.3 QUIET)
if(NOT TARGET glfw AND NOT TARGET glfw3)
    include(FetchContent)
    set(GLFW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
    set(GLFW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(GLFW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    FetchContent_Declare(glfw GIT_REPOSITORY https://github.com/glfw/glfw.git GIT_TAG 3.4 GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(glfw)
endif()
if(TARGET glfw)
    set(MC2_GLFW glfw)
elseif(TARGET glfw3)
    set(MC2_GLFW glfw3)
endif()

add_library(glad STATIC external/glad/src/gl.c)
target_include_directories(glad PUBLIC external/glad/include)

add_library(fastnoiselite INTERFACE)
target_include_directories(fastnoiselite INTERFACE external/FastNoiseLite)
add_library(stb INTERFACE)
target_include_directories(stb INTERFACE external/stb)

set(MC2_SOURCES
    src/main.cpp
    src/core/SimulationThread.cpp
    src/render/Camera.cpp
    src/render/Shader.cpp
    src/render/Texture.cpp
    src/render/ChunkMesh.cpp
    src/render/ChunkRenderer.cpp
    src/world/Chunk.cpp
    src/world/World.cpp
    src/world/Water.cpp
    src/world/Redstone.cpp
    src/math/Raycast.cpp
    src/physics/Physics.cpp
    src/entity/Entities.cpp
    src/ui/UI.cpp
    src/ui/Chat.cpp
)
add_executable(minecraft2 ${MC2_SOURCES})
target_include_directories(minecraft2 PRIVATE include src)
target_link_libraries(minecraft2 PRIVATE glad ${MC2_GLFW} OpenGL::GL fastnoiselite stb)
if(APPLE)
    target_link_libraries(minecraft2 PRIVATE "-framework Cocoa" "-framework IOKit" "-framework CoreVideo" "-framework OpenGL")
endif()

add_custom_command(TARGET minecraft2 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_CURRENT_SOURCE_DIR}/assets $<TARGET_FILE_DIR:minecraft2>/assets)

message(STATUS "Minecraft2 ${PROJECT_VERSION} arch=${CMAKE_OSX_ARCHITECTURES}")
