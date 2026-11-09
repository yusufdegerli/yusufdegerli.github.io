#pragma once

#include "minecraft2/math/Vec3.hpp"

#include <cmath>

namespace mc2 {

struct Mat4 {
    float m[16]{};

    static Mat4 identity()
    {
        Mat4 r;
        r.m[0] = r.m[5] = r.m[10] = r.m[15] = 1.0f;
        return r;
    }

    static Mat4 multiply(const Mat4& a, const Mat4& b)
    {
        Mat4 r;
        for (int col = 0; col < 4; ++col) {
            for (int row = 0; row < 4; ++row) {
                r.m[col * 4 + row] =
                    a.m[0 * 4 + row] * b.m[col * 4 + 0] +
                    a.m[1 * 4 + row] * b.m[col * 4 + 1] +
                    a.m[2 * 4 + row] * b.m[col * 4 + 2] +
                    a.m[3 * 4 + row] * b.m[col * 4 + 3];
            }
        }
        return r;
    }

    Mat4 operator*(const Mat4& o) const { return multiply(*this, o); }

    static Mat4 translate(const Vec3& t)
    {
        Mat4 r = identity();
        r.m[12] = t.x;
        r.m[13] = t.y;
        r.m[14] = t.z;
        return r;
    }

    static Mat4 scale(const Vec3& s)
    {
        Mat4 r = identity();
        r.m[0]  = s.x;
        r.m[5]  = s.y;
        r.m[10] = s.z;
        return r;
    }

    static Mat4 perspective(float fovyRadians, float aspect, float zNear, float zFar)
    {
        Mat4 r;
        const float f = 1.0f / std::tan(fovyRadians * 0.5f);
        r.m[0]  = f / aspect;
        r.m[5]  = f;
        r.m[10] = (zFar + zNear) / (zNear - zFar);
        r.m[11] = -1.0f;
        r.m[14] = (2.0f * zFar * zNear) / (zNear - zFar);
        return r;
    }

    // 2D UI / hotbar — orthographic projection (OpenGL NDC).
    static Mat4 ortho(float left, float right, float bottom, float top, float zNear, float zFar)
    {
        Mat4 r = identity();
        r.m[0]  =  2.0f / (right - left);
        r.m[5]  =  2.0f / (top - bottom);
        r.m[10] = -2.0f / (zFar - zNear);
        r.m[12] = -(right + left) / (right - left);
        r.m[13] = -(top + bottom) / (top - bottom);
        r.m[14] = -(zFar + zNear) / (zFar - zNear);
        return r;
    }

    static Mat4 lookAt(const Vec3& eye, const Vec3& center, const Vec3& up)
    {
        const Vec3 f = (center - eye).normalized();
        const Vec3 s = Vec3::cross(f, up).normalized();
        const Vec3 u = Vec3::cross(s, f);

        Mat4 r = identity();
        r.m[0] = s.x;  r.m[4] = s.y;  r.m[8]  = s.z;
        r.m[1] = u.x;  r.m[5] = u.y;  r.m[9]  = u.z;
        r.m[2] = -f.x; r.m[6] = -f.y; r.m[10] = -f.z;
        r.m[12] = -Vec3::dot(s, eye);
        r.m[13] = -Vec3::dot(u, eye);
        r.m[14] =  Vec3::dot(f, eye);
        return r;
    }

    const float* data() const { return m; }
};

} // namespace mc2
