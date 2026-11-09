#pragma once

#include "minecraft2/math/Mat4.hpp"
#include "minecraft2/math/Vec3.hpp"

struct GLFWwindow;

namespace mc2 {

// High-performance FPS-style fly camera (creative-mode movement for now).
class Camera {
public:
    Camera();
    explicit Camera(const Vec3& position);

    void setPosition(const Vec3& position);
    const Vec3& position() const { return m_position; }

    void setYawPitch(float yawDegrees, float pitchDegrees);
    float yaw() const { return m_yaw; }
    float pitch() const { return m_pitch; }

    // Mouse look — call from cursor-position callback with absolute cursor pos.
    void processMouseMovement(double xpos, double ypos, bool invertY = false);

    // Reset internal mouse baseline (call once after capturing the cursor).
    void resetMouse(double xpos, double ypos);

    // Keyboard movement (WASD + Space/Shift). deltaTime in seconds.
    void processKeyboard(GLFWwindow* window, float deltaTime);

    Vec3 front() const;
    Vec3 right() const;
    Vec3 up() const;

    Mat4 viewMatrix() const;
    Mat4 projectionMatrix(float aspect) const;

    void setMoveSpeed(float speed) { m_moveSpeed = speed; }
    void setMouseSensitivity(float s) { m_mouseSensitivity = s; }
    void setFovDegrees(float fov) { m_fovDegrees = fov; }

private:
    void updateVectors();
    void clampPitch();

    Vec3 m_position{0.0f, 80.0f, 0.0f};
    Vec3 m_front{0.0f, 0.0f, -1.0f};
    Vec3 m_up{0.0f, 1.0f, 0.0f};
    Vec3 m_right{1.0f, 0.0f, 0.0f};
    Vec3 m_worldUp{0.0f, 1.0f, 0.0f};

    float m_yaw   = -90.0f; // looking toward -Z
    float m_pitch = 0.0f;

    float m_moveSpeed        = 12.0f;
    float m_mouseSensitivity = 0.08f;
    float m_fovDegrees       = 70.0f;
    float m_nearPlane        = 0.1f;
    float m_farPlane         = 1000.0f;

    bool   m_firstMouse = true;
    double m_lastX      = 0.0;
    double m_lastY      = 0.0;
};

} // namespace mc2
