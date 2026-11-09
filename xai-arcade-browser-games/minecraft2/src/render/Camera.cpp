#include "minecraft2/render/Camera.hpp"

#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>

#include <algorithm>
#include <cmath>

namespace mc2 {
namespace {

constexpr float kPi = 3.14159265358979323846f;

float toRadians(float degrees)
{
    return degrees * (kPi / 180.0f);
}

} // namespace

Camera::Camera()
{
    updateVectors();
}

Camera::Camera(const Vec3& position)
    : m_position(position)
{
    updateVectors();
}

void Camera::setPosition(const Vec3& position)
{
    m_position = position;
}

void Camera::setYawPitch(float yawDegrees, float pitchDegrees)
{
    m_yaw   = yawDegrees;
    m_pitch = pitchDegrees;
    clampPitch();
    updateVectors();
}

void Camera::resetMouse(double xpos, double ypos)
{
    m_lastX      = xpos;
    m_lastY      = ypos;
    m_firstMouse = false;
}

void Camera::processMouseMovement(double xpos, double ypos, bool invertY)
{
    if (m_firstMouse) {
        m_lastX      = xpos;
        m_lastY      = ypos;
        m_firstMouse = false;
        return;
    }

    float xoffset = static_cast<float>(xpos - m_lastX);
    float yoffset = static_cast<float>(m_lastY - ypos); // GLFW: y grows downward
    if (invertY) {
        yoffset = -yoffset;
    }

    m_lastX = xpos;
    m_lastY = ypos;

    xoffset *= m_mouseSensitivity;
    yoffset *= m_mouseSensitivity;

    m_yaw += xoffset;
    m_pitch += yoffset;
    clampPitch();
    updateVectors();
}

void Camera::processKeyboard(GLFWwindow* window, float deltaTime)
{
    if (!window) {
        return;
    }

    // Sprint with Left Shift held together with movement keys is common;
    // we use Space/LeftCtrl for vertical fly, and Left Shift as speed boost.
    float speed = m_moveSpeed * deltaTime;
    if (glfwGetKey(window, GLFW_KEY_LEFT_SHIFT) == GLFW_PRESS) {
        speed *= 2.5f;
    }

    const Vec3 flatFront = Vec3{m_front.x, 0.0f, m_front.z}.normalized();
    const Vec3 flatRight = Vec3{m_right.x, 0.0f, m_right.z}.normalized();

    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
        m_position += flatFront * speed;
    }
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
        m_position -= flatFront * speed;
    }
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
        m_position -= flatRight * speed;
    }
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
        m_position += flatRight * speed;
    }
    if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS) {
        m_position += m_worldUp * speed;
    }
    if (glfwGetKey(window, GLFW_KEY_LEFT_CONTROL) == GLFW_PRESS) {
        m_position -= m_worldUp * speed;
    }
}

Vec3 Camera::front() const { return m_front; }
Vec3 Camera::right() const { return m_right; }
Vec3 Camera::up() const { return m_up; }

Mat4 Camera::viewMatrix() const
{
    return Mat4::lookAt(m_position, m_position + m_front, m_up);
}

Mat4 Camera::projectionMatrix(float aspect) const
{
    const float safeAspect = (aspect > 1e-4f) ? aspect : 1.0f;
    return Mat4::perspective(toRadians(m_fovDegrees), safeAspect, m_nearPlane, m_farPlane);
}

void Camera::updateVectors()
{
    const float yawR   = toRadians(m_yaw);
    const float pitchR = toRadians(m_pitch);

    Vec3 front;
    front.x = std::cos(yawR) * std::cos(pitchR);
    front.y = std::sin(pitchR);
    front.z = std::sin(yawR) * std::cos(pitchR);
    m_front = front.normalized();
    m_right = Vec3::cross(m_front, m_worldUp).normalized();
    m_up    = Vec3::cross(m_right, m_front).normalized();
}

void Camera::clampPitch()
{
    // Avoid gimbal lock at the poles.
    m_pitch = std::clamp(m_pitch, -89.0f, 89.0f);
}

} // namespace mc2
