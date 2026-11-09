#include "minecraft2/render/Shader.hpp"

#include <glad/gl.h>

#include <fstream>
#include <iostream>
#include <sstream>
#include <utility>
#include <vector>

namespace mc2 {

Shader::~Shader()
{
    destroy();
}

Shader::Shader(Shader&& other) noexcept
    : m_program(other.m_program)
{
    other.m_program = 0;
}

Shader& Shader::operator=(Shader&& other) noexcept
{
    if (this != &other) {
        destroy();
        m_program       = other.m_program;
        other.m_program = 0;
    }
    return *this;
}

void Shader::destroy()
{
    if (m_program != 0) {
        glDeleteProgram(m_program);
        m_program = 0;
    }
}

std::string Shader::readFile(const std::string& path)
{
    std::ifstream file(path, std::ios::in | std::ios::binary);
    if (!file) {
        return {};
    }
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

unsigned int Shader::compileShader(unsigned int type, const char* source, std::string& errorLog)
{
    const unsigned int shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    int success = 0;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
    if (!success) {
        int logLen = 0;
        glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &logLen);
        std::vector<char> log(static_cast<std::size_t>(logLen > 1 ? logLen : 1));
        glGetShaderInfoLog(shader, logLen, nullptr, log.data());
        errorLog.assign(log.data());
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

bool Shader::linkProgram(unsigned int vs, unsigned int fs, std::string& errorLog)
{
    m_program = glCreateProgram();
    glAttachShader(m_program, vs);
    glAttachShader(m_program, fs);
    glLinkProgram(m_program);

    int success = 0;
    glGetProgramiv(m_program, GL_LINK_STATUS, &success);
    if (!success) {
        int logLen = 0;
        glGetProgramiv(m_program, GL_INFO_LOG_LENGTH, &logLen);
        std::vector<char> log(static_cast<std::size_t>(logLen > 1 ? logLen : 1));
        glGetProgramInfoLog(m_program, logLen, nullptr, log.data());
        errorLog.assign(log.data());
        glDeleteProgram(m_program);
        m_program = 0;
        return false;
    }
    return true;
}

bool Shader::loadFromFiles(const std::string& vertexPath, const std::string& fragmentPath)
{
    const std::string vsrc = readFile(vertexPath);
    const std::string fsrc = readFile(fragmentPath);
    if (vsrc.empty()) {
        std::cerr << "[Shader] Failed to read vertex shader: " << vertexPath << '\n';
        return false;
    }
    if (fsrc.empty()) {
        std::cerr << "[Shader] Failed to read fragment shader: " << fragmentPath << '\n';
        return false;
    }
    return loadFromSource(vsrc, fsrc);
}

bool Shader::loadFromSource(const std::string& vertexSrc, const std::string& fragmentSrc)
{
    destroy();

    std::string error;
    const unsigned int vs = compileShader(GL_VERTEX_SHADER, vertexSrc.c_str(), error);
    if (vs == 0) {
        std::cerr << "[Shader] Vertex compile error:\n" << error << '\n';
        return false;
    }

    const unsigned int fs = compileShader(GL_FRAGMENT_SHADER, fragmentSrc.c_str(), error);
    if (fs == 0) {
        std::cerr << "[Shader] Fragment compile error:\n" << error << '\n';
        glDeleteShader(vs);
        return false;
    }

    if (!linkProgram(vs, fs, error)) {
        std::cerr << "[Shader] Link error:\n" << error << '\n';
        glDeleteShader(vs);
        glDeleteShader(fs);
        return false;
    }

    glDeleteShader(vs);
    glDeleteShader(fs);
    return true;
}

void Shader::use() const
{
    glUseProgram(m_program);
}

void Shader::setBool(const std::string& name, bool value) const
{
    glUniform1i(glGetUniformLocation(m_program, name.c_str()), value ? 1 : 0);
}

void Shader::setInt(const std::string& name, int value) const
{
    glUniform1i(glGetUniformLocation(m_program, name.c_str()), value);
}

void Shader::setFloat(const std::string& name, float value) const
{
    glUniform1f(glGetUniformLocation(m_program, name.c_str()), value);
}

void Shader::setVec3(const std::string& name, const Vec3& v) const
{
    glUniform3f(glGetUniformLocation(m_program, name.c_str()), v.x, v.y, v.z);
}

void Shader::setMat4(const std::string& name, const Mat4& mat) const
{
    glUniformMatrix4fv(glGetUniformLocation(m_program, name.c_str()), 1, GL_FALSE, mat.data());
}

} // namespace mc2
