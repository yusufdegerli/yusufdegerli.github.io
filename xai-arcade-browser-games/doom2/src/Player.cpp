#include "Player.hpp"
#include "Enemy.hpp"

#include <raylib.h>

#include <algorithm>
#include <cmath>

namespace {

void FacingToDir(Facing facing, double& dirX, double& dirY) noexcept
{
    switch (facing) {
    case Facing::East:  dirX = 1;  dirY = 0;  break;
    case Facing::North: dirX = 0;  dirY = -1; break;
    case Facing::West:  dirX = -1; dirY = 0;  break;
    case Facing::South: dirX = 0;  dirY = 1;  break;
    }
}

} // namespace

void Player::SpawnFromMap(const Map& map)
{
    m_x     = static_cast<double>(map.Spawn().gridX) + 0.5;
    m_y     = static_cast<double>(map.Spawn().gridY) + 0.5;
    m_floor = map.Spawn().floor;
    m_pitch = 0.0;
    m_bobPhase   = 0.0;
    m_moveAmount = 0.0;
    ResetInventory();
    SetFacing(map.Spawn().facing);
}

void Player::ResetInventory() noexcept
{
    m_ownPistol = m_ownShotgun = m_ownPortalGun = false;
    m_ammoPistol = m_ammoShotgun = 0;
    m_current  = WeaponSlot::None;
    m_fireAnim = 0.0f;
}

bool Player::Owns(WeaponSlot slot) const noexcept
{
    switch (slot) {
    case WeaponSlot::Pistol:    return m_ownPistol;
    case WeaponSlot::Shotgun:   return m_ownShotgun;
    case WeaponSlot::PortalGun: return m_ownPortalGun;
    default: return false;
    }
}

bool Player::HasAnyWeapon() const noexcept
{
    return m_ownPistol || m_ownShotgun || m_ownPortalGun;
}

int Player::AmmoFor(WeaponSlot slot) const noexcept
{
    switch (slot) {
    case WeaponSlot::Pistol:  return m_ammoPistol;
    case WeaponSlot::Shotgun: return m_ammoShotgun;
    case WeaponSlot::PortalGun: return 999; // unlimited
    default: return 0;
    }
}

void Player::GivePistol(int ammo)
{
    m_ownPistol = true;
    m_ammoPistol += std::max(0, ammo);
    if (m_current == WeaponSlot::None) {
        m_current = WeaponSlot::Pistol;
    }
}

void Player::GiveShotgun(int ammo)
{
    m_ownShotgun = true;
    m_ammoShotgun += std::max(0, ammo);
    if (m_current == WeaponSlot::None) {
        m_current = WeaponSlot::Shotgun;
    }
}

void Player::GivePortalGun()
{
    m_ownPortalGun = true;
    if (m_current == WeaponSlot::None) {
        m_current = WeaponSlot::PortalGun;
    }
}

void Player::AddAmmo(int amount) noexcept
{
    if (amount <= 0) {
        return;
    }
    // Split ammo between owned ballistic weapons
    if (m_ownPistol && m_ownShotgun) {
        m_ammoPistol += amount / 2 + amount % 2;
        m_ammoShotgun += amount / 2;
    } else if (m_ownPistol) {
        m_ammoPistol += amount;
    } else if (m_ownShotgun) {
        m_ammoShotgun += amount;
    } else {
        // Stockpile on pistol for when acquired
        m_ammoPistol += amount;
    }
}

bool Player::SelectWeapon(WeaponSlot slot)
{
    if (!Owns(slot)) {
        return false;
    }
    m_current  = slot;
    m_fireAnim = 0.0f;
    return true;
}

bool Player::TryFireCombat()
{
    if (m_current != WeaponSlot::Pistol && m_current != WeaponSlot::Shotgun) {
        return false;
    }
    if (m_fireAnim > 0.0f) {
        return false;
    }

    if (m_current == WeaponSlot::Pistol) {
        if (m_ammoPistol <= 0) {
            return false;
        }
        --m_ammoPistol;
        m_fireAnim = m_settings.fireAnimDuration;
        return true;
    }

    // Shotgun
    if (m_ammoShotgun <= 0) {
        return false;
    }
    --m_ammoShotgun;
    m_fireAnim = m_settings.shotgunAnimDuration;
    return true;
}

void Player::UpdateWeapon(float deltaTime)
{
    if (m_fireAnim > 0.0f) {
        m_fireAnim -= deltaTime;
        if (m_fireAnim < 0.0f) {
            m_fireAnim = 0.0f;
        }
    }
}

void Player::SetFacing(double dirX, double dirY) noexcept
{
    const double len = std::hypot(dirX, dirY);
    if (len < 1e-8) {
        dirX = 1.0;
        dirY = 0.0;
    } else {
        dirX /= len;
        dirY /= len;
    }
    m_dirX = dirX;
    m_dirY = dirY;
    constexpr double fovScale = 0.66;
    m_planeX = -m_dirY * fovScale;
    m_planeY =  m_dirX * fovScale;
}

void Player::SetFacing(Facing facing) noexcept
{
    double dx = 1.0, dy = 0.0;
    FacingToDir(facing, dx, dy);
    SetFacing(dx, dy);
}

void Player::Update(const Map& map,
                    float deltaTime,
                    bool mouseLook,
                    const EnemySystem* enemies)
{
    const double dt = static_cast<double>(deltaTime);
    if (dt <= 0.0) {
        return;
    }

    if (mouseLook) {
        const Vector2 delta = GetMouseDelta();
        if (delta.x != 0.0f) {
            Rotate(static_cast<double>(delta.x) * m_settings.mouseSens);
        }
        if (delta.y != 0.0f) {
            m_pitch -= static_cast<double>(delta.y) * m_settings.pitchSens;
            m_pitch = std::clamp(m_pitch, -m_settings.maxPitch, m_settings.maxPitch);
        }
    }

    if (IsKeyDown(KEY_LEFT) || IsKeyDown(KEY_Q)) {
        Rotate(-m_settings.rotSpeed * dt);
    }
    if (IsKeyDown(KEY_RIGHT) || IsKeyDown(KEY_E)) {
        Rotate(m_settings.rotSpeed * dt);
    }

    const double rightX = -m_dirY;
    const double rightY =  m_dirX;

    double moveX = 0.0, moveY = 0.0;
    if (IsKeyDown(KEY_W) || IsKeyDown(KEY_UP)) {
        moveX += m_dirX;
        moveY += m_dirY;
    }
    if (IsKeyDown(KEY_S) || IsKeyDown(KEY_DOWN)) {
        moveX -= m_dirX;
        moveY -= m_dirY;
    }
    if (IsKeyDown(KEY_A)) {
        moveX -= rightX;
        moveY -= rightY;
    }
    if (IsKeyDown(KEY_D)) {
        moveX += rightX;
        moveY += rightY;
    }

    bool moved = false;
    const double moveLen = std::hypot(moveX, moveY);
    if (moveLen > 1e-8) {
        moveX /= moveLen;
        moveY /= moveLen;
        double speed = m_settings.moveSpeed;
        if (IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT)) {
            speed *= m_settings.sprintMult;
        }
        const double bx = m_x, by = m_y;
        TryMove(map, moveX * speed * dt, moveY * speed * dt, enemies);
        moved = (std::abs(m_x - bx) + std::abs(m_y - by)) > 1e-8;
    }

    const double targetBob = moved ? 1.0 : 0.0;
    const double blend     = 1.0 - std::exp(-m_settings.bobDecay * dt);
    m_moveAmount += (targetBob - m_moveAmount) * blend;
    if (m_moveAmount > 0.01) {
        const double sprint =
            (IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT)) ? 1.35 : 1.0;
        m_bobPhase += m_settings.bobSpeed * sprint * m_moveAmount * dt;
    }

    UpdateWeapon(deltaTime);
}

void Player::Rotate(double angleRadians) noexcept
{
    const double c = std::cos(angleRadians);
    const double s = std::sin(angleRadians);
    const double oldDirX = m_dirX;
    m_dirX = m_dirX * c - m_dirY * s;
    m_dirY = oldDirX * s + m_dirY * c;
    const double oldPlaneX = m_planeX;
    m_planeX = m_planeX * c - m_planeY * s;
    m_planeY = oldPlaneX * s + m_planeY * c;
}

void Player::TryMove(const Map& map,
                     double dx,
                     double dy,
                     const EnemySystem* enemies) noexcept
{
    const double r = m_settings.radius;
    auto blocked = [&](double nx, double ny) {
        if (map.Collides(m_floor, nx, ny, r)) {
            return true;
        }
        if (enemies && enemies->CollidesLiving(m_floor, nx, ny, r)) {
            return true;
        }
        return false;
    };
    if (!blocked(m_x + dx, m_y)) {
        m_x += dx;
    }
    if (!blocked(m_x, m_y + dy)) {
        m_y += dy;
    }
}
