#pragma once

#include "Map.hpp"

enum class WeaponSlot : int {
    None      = 0,
    Pistol    = 1,
    Shotgun   = 2,
    PortalGun = 3,
};

/**
 * @brief First-person player: movement, inventory, multi-weapon, floor index.
 */
class Player {
public:
    struct Settings {
        double moveSpeed   = 3.5;
        double sprintMult  = 1.65;
        double rotSpeed    = 2.5;
        double mouseSens   = 0.0025;
        double pitchSens   = 0.0020;
        double maxPitch    = 0.65;
        double radius      = 0.18;
        double eyeHeight   = 0.5;
        double bobSpeed    = 10.0;
        double bobDecay    = 6.0;
        int    pistolAmmoOnPickup  = 12;
        int    shotgunAmmoOnPickup = 8;
        float  fireAnimDuration    = 0.18f;
        float  shotgunAnimDuration = 0.28f;
    };

    Player() = default;

    void SpawnFromMap(const Map& map);

    void SetSettings(const Settings& s) noexcept { m_settings = s; }
    [[nodiscard]] const Settings& GetSettings() const noexcept { return m_settings; }

    void Update(const Map& map,
                float deltaTime,
                bool mouseLook,
                const class EnemySystem* enemies = nullptr);

    /** Combat fire for pistol/shotgun (Space or LMB when not portal gun). */
    bool TryFireCombat();

    /** Select weapon slot 1/2/3 if owned. */
    bool SelectWeapon(WeaponSlot slot);

    void GivePistol(int ammo);
    void GiveShotgun(int ammo);
    void GivePortalGun();
    void AddAmmo(int amount) noexcept;
    void ResetInventory() noexcept;

    void UpdateWeapon(float deltaTime);

    [[nodiscard]] double X() const noexcept { return m_x; }
    [[nodiscard]] double Y() const noexcept { return m_y; }
    [[nodiscard]] double DirX() const noexcept { return m_dirX; }
    [[nodiscard]] double DirY() const noexcept { return m_dirY; }
    [[nodiscard]] double PlaneX() const noexcept { return m_planeX; }
    [[nodiscard]] double PlaneY() const noexcept { return m_planeY; }
    [[nodiscard]] double Pitch() const noexcept { return m_pitch; }
    [[nodiscard]] int    Floor() const noexcept { return m_floor; }

    [[nodiscard]] double MoveAmount() const noexcept { return m_moveAmount; }
    [[nodiscard]] double BobPhase() const noexcept { return m_bobPhase; }
    [[nodiscard]] bool   IsMoving() const noexcept { return m_moveAmount > 0.05; }

    [[nodiscard]] int  Score() const noexcept { return m_score; }
    void AddScore(int points) noexcept { m_score += points; }
    void ResetScore() noexcept { m_score = 0; }

    [[nodiscard]] WeaponSlot CurrentWeapon() const noexcept { return m_current; }
    [[nodiscard]] bool Owns(WeaponSlot slot) const noexcept;
    [[nodiscard]] bool HasAnyWeapon() const noexcept;
    [[nodiscard]] int  AmmoFor(WeaponSlot slot) const noexcept;
    [[nodiscard]] int  CurrentAmmo() const noexcept { return AmmoFor(m_current); }

    [[nodiscard]] float FireAnim() const noexcept { return m_fireAnim; }
    [[nodiscard]] bool  IsFiring() const noexcept { return m_fireAnim > 0.0f; }

    void SetPosition(double x, double y) noexcept
    {
        m_x = x;
        m_y = y;
    }
    void SetFloor(int floor) noexcept { m_floor = floor; }

    void SetFacing(double dirX, double dirY) noexcept;
    void SetFacing(Facing facing) noexcept;

private:
    void Rotate(double angleRadians) noexcept;
    void TryMove(const Map& map,
                 double dx,
                 double dy,
                 const class EnemySystem* enemies) noexcept;

    Settings m_settings{};

    double m_x = 1.5;
    double m_y = 1.5;
    int    m_floor = 0;

    double m_dirX   = 1.0;
    double m_dirY   = 0.0;
    double m_planeX = 0.0;
    double m_planeY = 0.66;

    double m_pitch      = 0.0;
    double m_bobPhase   = 0.0;
    double m_moveAmount = 0.0;
    int    m_score      = 0;

    bool       m_ownPistol    = false;
    bool       m_ownShotgun   = false;
    bool       m_ownPortalGun = false;
    int        m_ammoPistol   = 0;
    int        m_ammoShotgun  = 0;
    WeaponSlot m_current      = WeaponSlot::None;
    float      m_fireAnim     = 0.0f;
};
