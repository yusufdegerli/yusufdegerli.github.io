#pragma once

#include "minecraft2/math/Mat4.hpp"
#include "minecraft2/math/Vec3.hpp"

#include <string>

namespace mc2 {

class Shader {
public:
    Shader() = default;
    ~Shader();

    Shader(const Shader&) = delete;
    Shader& operator=(const Shader&) = delete;
    Shader(Shader&& other) noexcept;
    Shader& operator=(Shader&& other) noexcept;

    // Load vertex + fragment GLSL from text files, compile and link.
    bool loadFromFiles(const std::string& vertexPath, const std::string& fragmentPath);

    // Load from in-memory source strings (useful for tests / fallbacks).
    bool loadFromSource(const std::string& vertexSrc, const std::string& fragmentSrc);

    void use() const;
    unsigned int id() const { return m_program; }
    bool valid() const { return m_program != 0; }

    void setBool(const std::string& name, bool value) const;
    void setInt(const std::string& name, int value) const;
    void setFloat(const std::string& name, float value) const;
    void setVec3(const std::string& name, const Vec3& v) const;
    void setMat4(const std::string& name, const Mat4& mat) const;

private:
    static std::string readFile(const std::string& path);
    static unsigned int compileShader(unsigned int type, const char* source, std::string& errorLog);
    bool linkProgram(unsigned int vs, unsigned int fs, std::string& errorLog);
    void destroy();

    unsigned int m_program = 0;
};

} // namespace mc2
