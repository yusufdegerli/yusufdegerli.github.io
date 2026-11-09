#include "Game.hpp"

#include <cstdlib>
#include <exception>
#include <iostream>

int main(int argc, char* argv[])
{
    try {
        Game::Config config{};
        config.screenWidth  = 1280;
        config.screenHeight = 720;
        config.title        = "Doom 64 Clone";
        config.targetFps    = 60;
        config.fullscreen   = false;
        config.vsync        = true;
        config.startMap     = "level01.cub";

        // Optional: ./Doom64Clone maps/test.cub
        if (argc >= 2 && argv[1] != nullptr) {
            config.startMap = argv[1];
        }

        Game game(std::move(config));

        if (!game.Init()) {
            std::cerr << "Fatal: game failed to initialize.\n";
            return EXIT_FAILURE;
        }

        game.Run();
        return EXIT_SUCCESS;
    } catch (const std::exception& ex) {
        std::cerr << "Unhandled exception: " << ex.what() << '\n';
        return EXIT_FAILURE;
    } catch (...) {
        std::cerr << "Unhandled unknown exception.\n";
        return EXIT_FAILURE;
    }
}
