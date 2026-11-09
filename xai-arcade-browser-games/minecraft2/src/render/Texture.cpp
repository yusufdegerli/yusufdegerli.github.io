#include "minecraft2/render/Texture.hpp"

#include <glad/gl.h>

#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

#include <iostream>
#include <utility>

namespace mc2 {

Texture::~Texture()
{
    destroy();
}

Texture::Texture(Texture&& other) noexcept
    : m_id(other.m_id)
    , m_width(other.m_width)
    , m_height(other.m_height)
{
    other.m_id     = 0;
    other.m_width  = 0;
    other.m_height = 0;
}

Texture& Texture::operator=(Texture&& other) noexcept
{
    if (this != &other) {
        destroy();
        m_id           = other.m_id;
        m_width        = other.m_width;
        m_height       = other.m_height;
        other.m_id     = 0;
        other.m_width  = 0;
        other.m_height = 0;
    }
    return *this;
}

void Texture::destroy()
{
    if (m_id != 0) {
        glDeleteTextures(1, &m_id);
        m_id = 0;
    }
}

bool Texture::loadFromFile(const std::string& path, bool flipVertically)
{
    destroy();

    stbi_set_flip_vertically_on_load(flipVertically ? 1 : 0);

    int channels = 0;
    unsigned char* data = stbi_load(path.c_str(), &m_width, &m_height, &channels, 4);
    if (!data) {
        std::cerr << "[Texture] Failed to load '" << path << "': "
                  << stbi_failure_reason() << '\n';
        m_width = m_height = 0;
        return false;
    }

    glGenTextures(1, &m_id);
    glBindTexture(GL_TEXTURE_2D, m_id);

    // Pixelated classic Minecraft look — NEVER use linear filtering here.
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, m_width, m_height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
    // No mipmaps: mipmaps + NEAREST_MIPMAP would still soften distant blocks.
    // Pure NEAREST keeps every texel hard-edged.

    glBindTexture(GL_TEXTURE_2D, 0);
    stbi_image_free(data);

    std::cout << "[Texture] Loaded '" << path << "' (" << m_width << 'x' << m_height
              << ") GL_NEAREST\n";
    return true;
}

void Texture::bind(unsigned int unit) const
{
    glActiveTexture(GL_TEXTURE0 + unit);
    glBindTexture(GL_TEXTURE_2D, m_id);
}

void Texture::unbind() const
{
    glBindTexture(GL_TEXTURE_2D, 0);
}

} // namespace mc2
