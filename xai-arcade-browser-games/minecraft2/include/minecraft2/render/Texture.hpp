#pragma once

#include <string>

namespace mc2 {

class Texture {
public:
    Texture() = default;
    ~Texture();

    Texture(const Texture&) = delete;
    Texture& operator=(const Texture&) = delete;
    Texture(Texture&& other) noexcept;
    Texture& operator=(Texture&& other) noexcept;

    // Load an image with stb_image and upload as GL_TEXTURE_2D.
    // Uses GL_NEAREST min/mag filters for the classic pixelated Minecraft look.
    bool loadFromFile(const std::string& path, bool flipVertically = true);

    void bind(unsigned int unit = 0) const;
    void unbind() const;

    unsigned int id() const { return m_id; }
    int width() const { return m_width; }
    int height() const { return m_height; }
    bool valid() const { return m_id != 0; }

private:
    void destroy();

    unsigned int m_id     = 0;
    int          m_width  = 0;
    int          m_height = 0;
};

} // namespace mc2
