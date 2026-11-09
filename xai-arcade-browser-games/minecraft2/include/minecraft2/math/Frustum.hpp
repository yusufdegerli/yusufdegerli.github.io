#pragma once

#include "minecraft2/math/Mat4.hpp"
#include "minecraft2/math/Vec3.hpp"

namespace mc2 {

struct AABB {
    Vec3 min{};
    Vec3 max{};
};

// Six frustum planes extracted from view-projection matrix.
// Plane equation: ax + by + cz + d = 0, normal points inward.
struct Frustum {
    float planes[6][4]{}; // a,b,c,d for left,right,bottom,top,near,far

    static Frustum fromViewProjection(const Mat4& viewProj)
    {
        Frustum f;
        const float* m = viewProj.m;
        // Column-major clip matrix rows combined.
        // Left
        f.planes[0][0] = m[3]  + m[0];
        f.planes[0][1] = m[7]  + m[4];
        f.planes[0][2] = m[11] + m[8];
        f.planes[0][3] = m[15] + m[12];
        // Right
        f.planes[1][0] = m[3]  - m[0];
        f.planes[1][1] = m[7]  - m[4];
        f.planes[1][2] = m[11] - m[8];
        f.planes[1][3] = m[15] - m[12];
        // Bottom
        f.planes[2][0] = m[3]  + m[1];
        f.planes[2][1] = m[7]  + m[5];
        f.planes[2][2] = m[11] + m[9];
        f.planes[2][3] = m[15] + m[13];
        // Top
        f.planes[3][0] = m[3]  - m[1];
        f.planes[3][1] = m[7]  - m[5];
        f.planes[3][2] = m[11] - m[9];
        f.planes[3][3] = m[15] - m[13];
        // Near
        f.planes[4][0] = m[3]  + m[2];
        f.planes[4][1] = m[7]  + m[6];
        f.planes[4][2] = m[11] + m[10];
        f.planes[4][3] = m[15] + m[14];
        // Far
        f.planes[5][0] = m[3]  - m[2];
        f.planes[5][1] = m[7]  - m[6];
        f.planes[5][2] = m[11] - m[10];
        f.planes[5][3] = m[15] - m[14];

        for (int i = 0; i < 6; ++i) {
            const float len = std::sqrt(
                f.planes[i][0] * f.planes[i][0] +
                f.planes[i][1] * f.planes[i][1] +
                f.planes[i][2] * f.planes[i][2]);
            if (len > 1e-6f) {
                f.planes[i][0] /= len;
                f.planes[i][1] /= len;
                f.planes[i][2] /= len;
                f.planes[i][3] /= len;
            }
        }
        return f;
    }

    bool intersectsAABB(const AABB& box) const
    {
        for (int i = 0; i < 6; ++i) {
            const float* p = planes[i];
            // Positive vertex along plane normal
            const float x = (p[0] >= 0.0f) ? box.max.x : box.min.x;
            const float y = (p[1] >= 0.0f) ? box.max.y : box.min.y;
            const float z = (p[2] >= 0.0f) ? box.max.z : box.min.z;
            if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0.0f) {
                return false;
            }
        }
        return true;
    }
};

} // namespace mc2
