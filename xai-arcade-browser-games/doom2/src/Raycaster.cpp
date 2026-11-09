#include "Raycaster.hpp"

#include <algorithm>
#include <cmath>

Raycaster::~Raycaster()
{
    if (m_frameReady && m_frameTex.id > 0) {
        UnloadTexture(m_frameTex);
        m_frameTex   = {};
        m_frameReady = false;
    }
}

Color Raycaster::LerpColor(Color a, Color b, float t) noexcept
{
    t = std::clamp(t, 0.0f, 1.0f);
    return Color{
        static_cast<unsigned char>(a.r + (b.r - a.r) * t),
        static_cast<unsigned char>(a.g + (b.g - a.g) * t),
        static_cast<unsigned char>(a.b + (b.b - a.b) * t),
        255,
    };
}

Color Raycaster::ApplyFog(Color c, float dist) const noexcept
{
    float t = 0.0f;
    if (dist > m_settings.fogStart && m_settings.fogEnd > m_settings.fogStart) {
        t = std::clamp((dist - m_settings.fogStart)
                           / (m_settings.fogEnd - m_settings.fogStart),
                       0.0f, 1.0f);
    }
    Color out = LerpColor(c, m_settings.fog, t);
    out.a     = c.a;
    return out;
}

Color Raycaster::Darken(Color c, float factor) const noexcept
{
    factor = std::clamp(factor, 0.0f, 1.0f);
    return Color{
        static_cast<unsigned char>(c.r * factor),
        static_cast<unsigned char>(c.g * factor),
        static_cast<unsigned char>(c.b * factor),
        c.a,
    };
}

void Raycaster::PutPixel(int x, int y, Color c) noexcept
{
    if (x < 0 || y < 0 || x >= m_w || y >= m_h) {
        return;
    }
    if (c.a >= 250) {
        m_pixels[static_cast<std::size_t>(y * m_w + x)] = c;
        return;
    }
    if (c.a == 0) {
        return;
    }
    Color& dst = m_pixels[static_cast<std::size_t>(y * m_w + x)];
    const float a  = c.a / 255.0f;
    const float ia = 1.0f - a;
    dst = Color{
        static_cast<unsigned char>(c.r * a + dst.r * ia),
        static_cast<unsigned char>(c.g * a + dst.g * ia),
        static_cast<unsigned char>(c.b * a + dst.b * ia),
        255,
    };
}

bool Raycaster::IsPortalWall(const Portal& p, int floor, int mapX, int mapY, int side) noexcept
{
    return p.active && p.floor == floor && p.wallX == mapX && p.wallY == mapY && p.side == side;
}

void Raycaster::EnsureBuffer(int w, int h)
{
    if (w <= 0 || h <= 0) {
        return;
    }
    if (m_w == w && m_h == h && m_frameReady) {
        return;
    }
    if (m_frameReady && m_frameTex.id > 0) {
        UnloadTexture(m_frameTex);
        m_frameTex   = {};
        m_frameReady = false;
    }
    m_w = w;
    m_h = h;
    m_pixels.assign(static_cast<std::size_t>(w * h), Color{0, 0, 0, 255});
    m_zBuffer.assign(static_cast<std::size_t>(w), 1e30);
    Image img{
        .data    = m_pixels.data(),
        .width   = w,
        .height  = h,
        .mipmaps = 1,
        .format  = PIXELFORMAT_UNCOMPRESSED_R8G8B8A8,
    };
    m_frameTex   = LoadTextureFromImage(img);
    m_frameReady = m_frameTex.id > 0;
}

void Raycaster::Render(const Map& map,
                       const Player& player,
                       const EnemySystem& enemies,
                       const PortalSystem& portals,
                       int screenW,
                       int screenH,
                       float timeSeconds)
{
    if (screenW <= 0 || screenH <= 0 || map.Empty()) {
        return;
    }
    EnsureBuffer(screenW, screenH);
    if (!m_frameReady) {
        ClearBackground(Color{8, 8, 16, 255});
        return;
    }

    std::fill(m_pixels.begin(), m_pixels.end(), m_settings.fog);
    std::fill(m_zBuffer.begin(), m_zBuffer.end(), 1e30);

    RenderWorld(map, player, portals, timeSeconds);
    RenderSprites(map, player, enemies, timeSeconds);

    UpdateTexture(m_frameTex, m_pixels.data());
    DrawTexture(m_frameTex, 0, 0, WHITE);
    RenderViewmodel(player, screenW, screenH);
}

void Raycaster::RenderWorld(const Map& map,
                            const Player& player,
                            const PortalSystem& portals,
                            float /*timeSeconds*/)
{
    const int floor = player.Floor();
    const double posX = player.X();
    const double posY = player.Y();
    const double dirX = player.DirX();
    const double dirY = player.DirY();
    const double planeX = player.PlaneX();
    const double planeY = player.PlaneY();
    const int pitchPixels =
        static_cast<int>(player.Pitch() * static_cast<double>(m_h));

    const PixelTexture* wallTex =
        (m_textures && m_textures->Wall().ready) ? &m_textures->Wall() : nullptr;
    const PixelTexture* floorTex =
        (m_textures && m_textures->Floor().ready) ? &m_textures->Floor() : nullptr;
    const PixelTexture* ceilTex =
        (m_textures && m_textures->Ceiling().ready) ? &m_textures->Ceiling() : nullptr;
    const PixelTexture* blueTex =
        (m_textures && m_textures->PortalBlue().ready) ? &m_textures->PortalBlue() : nullptr;
    const PixelTexture* orangeTex =
        (m_textures && m_textures->PortalOrange().ready) ? &m_textures->PortalOrange()
                                                          : nullptr;

    for (int col = 0; col < m_w; ++col) {
        const double cameraX =
            2.0 * static_cast<double>(col) / static_cast<double>(m_w) - 1.0;
        const double rayDirX = dirX + planeX * cameraX;
        const double rayDirY = dirY + planeY * cameraX;

        int mapX = static_cast<int>(std::floor(posX));
        int mapY = static_cast<int>(std::floor(posY));

        const double deltaDistX = (rayDirX == 0.0) ? 1e30 : std::abs(1.0 / rayDirX);
        const double deltaDistY = (rayDirY == 0.0) ? 1e30 : std::abs(1.0 / rayDirY);

        int stepX = 0, stepY = 0, side = 0;
        double sideDistX = 0.0, sideDistY = 0.0;

        if (rayDirX < 0.0) {
            stepX = -1;
            sideDistX = (posX - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - posX) * deltaDistX;
        }
        if (rayDirY < 0.0) {
            stepY = -1;
            sideDistY = (posY - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - posY) * deltaDistY;
        }

        bool hit = false;
        for (int s = 0; s < 64; ++s) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }
            if (map.IsSolid(floor, mapX, mapY)) {
                hit = true;
                break;
            }
        }

        double perpWallDist = 1e30;
        if (hit) {
            if (side == 0) {
                perpWallDist =
                    (mapX - posX + (1 - stepX) / 2.0) / rayDirX;
            } else {
                perpWallDist =
                    (mapY - posY + (1 - stepY) / 2.0) / rayDirY;
            }
            if (perpWallDist < 1e-6) {
                perpWallDist = 1e-6;
            }
        }
        m_zBuffer[static_cast<std::size_t>(col)] = perpWallDist;

        const int lineHeight =
            hit ? static_cast<int>(m_h / perpWallDist) : 0;
        int drawStart = -lineHeight / 2 + m_h / 2 + pitchPixels;
        int drawEnd   = lineHeight / 2 + m_h / 2 + pitchPixels;

        // Floor / ceiling
        for (int y = 0; y < m_h; ++y) {
            const bool isCeiling = y < (m_h / 2 + pitchPixels);
            const bool inWall =
                hit && y >= drawStart && y <= drawEnd && drawStart <= drawEnd;
            if (inWall) {
                continue;
            }
            const double rowRel = static_cast<double>(y - (m_h / 2 + pitchPixels));
            if (std::abs(rowRel) < 1e-6) {
                continue;
            }
            const double camZ = 0.5 * m_h;
            const double rowDistance = std::abs(camZ / rowRel);
            const double floorX = posX + rowDistance * rayDirX;
            const double floorY = posY + rowDistance * rayDirY;

            Color sample{20, 18, 28, 255};
            if (isCeiling && ceilTex) {
                sample = ceilTex->Sample(floorX, floorY);
            } else if (!isCeiling && floorTex) {
                sample = floorTex->Sample(floorX, floorY);
            }
            // Slight tint per floor for multi-floor feedback
            if (floor == 1 && !isCeiling) {
                sample = Darken(sample, 0.85f);
                sample.b = static_cast<unsigned char>(std::min(255, sample.b + 20));
            }
            sample = ApplyFog(sample, static_cast<float>(rowDistance));
            PutPixel(col, y, sample);
        }

        if (!hit || drawEnd < drawStart) {
            continue;
        }

        double wallX =
            (side == 0) ? posY + perpWallDist * rayDirY : posX + perpWallDist * rayDirX;
        wallX -= std::floor(wallX);

        int texWidth = wallTex ? wallTex->width : 64;
        int texX = static_cast<int>(wallX * texWidth);
        if (side == 0 && rayDirX > 0.0) {
            texX = texWidth - texX - 1;
        }
        if (side == 1 && rayDirY < 0.0) {
            texX = texWidth - texX - 1;
        }
        texX = std::clamp(texX, 0, texWidth - 1);

        const bool isBlue =
            IsPortalWall(portals.Blue(), floor, mapX, mapY, side);
        const bool isOrange =
            IsPortalWall(portals.Orange(), floor, mapX, mapY, side);
        const PixelTexture* portalOverlay =
            isBlue ? blueTex : (isOrange ? orangeTex : nullptr);

        const int clampedStart = std::max(drawStart, 0);
        const int clampedEnd   = std::min(drawEnd, m_h - 1);
        const int texH = wallTex ? wallTex->height : 64;
        const double step = static_cast<double>(texH) / lineHeight;
        double texPos = static_cast<double>(clampedStart - drawStart) * step;

        for (int y = clampedStart; y <= clampedEnd; ++y) {
            int texY = static_cast<int>(texPos) % texH;
            if (texY < 0) {
                texY += texH;
            }
            texPos += step;

            Color sample =
                wallTex ? wallTex->SamplePixel(texX, texY) : Color{140, 48, 48, 255};
            if (side == 1) {
                sample = Darken(sample, 0.72f);
            }

            // Overlay portal texture (ellipse-like via sample alpha)
            if (portalOverlay) {
                const double v =
                    static_cast<double>(y - drawStart) / std::max(1, lineHeight);
                Color pc = portalOverlay->Sample(wallX, v);
                if (pc.a > 20) {
                    const float a = pc.a / 255.0f;
                    sample = Color{
                        static_cast<unsigned char>(pc.r * a + sample.r * (1 - a)),
                        static_cast<unsigned char>(pc.g * a + sample.g * (1 - a)),
                        static_cast<unsigned char>(pc.b * a + sample.b * (1 - a)),
                        255,
                    };
                }
            }

            sample = ApplyFog(sample, static_cast<float>(perpWallDist));
            PutPixel(col, y, sample);
        }
    }
}

void Raycaster::RenderSprites(const Map& map,
                              const Player& player,
                              const EnemySystem& enemies,
                              float timeSeconds)
{
    if (!m_textures) {
        return;
    }

    const int floor = player.Floor();
    const double posX = player.X();
    const double posY = player.Y();
    const double dirX = player.DirX();
    const double dirY = player.DirY();
    const double planeX = player.PlaneX();
    const double planeY = player.PlaneY();
    const int pitchPixels =
        static_cast<int>(player.Pitch() * static_cast<double>(m_h));

    std::vector<Billboard> sprites;
    sprites.reserve(128);

    for (int y = 0; y < map.Height(); ++y) {
        for (int x = 0; x < map.Width(); ++x) {
            const Tile t = map.At(floor, x, y);
            auto addPickup = [&](const PixelTexture& tex, float scale, float bobSpd,
                                 float bobAmp, float zBias = 0.f) {
                if (!tex.ready) {
                    return;
                }
                const double bob =
                    std::sin(timeSeconds * bobSpd + (x + y) * 0.5) * bobAmp;
                sprites.push_back(Billboard{
                    .x = x + 0.5, .y = y + 0.5, .z = bob + zBias,
                    .tex = &tex, .scale = scale, .isExit = false,
                });
            };

            switch (t) {
            case Tile::Coin:
                addPickup(m_textures->Coin(), 0.45f, m_settings.coinBobSpeed,
                          m_settings.coinBobAmp);
                break;
            case Tile::Exit:
                if (m_textures->Exit().ready) {
                    const double pulse =
                        0.05 * std::sin(timeSeconds * m_settings.exitPulseSpeed);
                    sprites.push_back(Billboard{
                        .x = x + 0.5, .y = y + 0.5, .z = pulse,
                        .tex = &m_textures->Exit(), .scale = 0.7f, .isExit = true,
                    });
                }
                break;
            case Tile::Weapon:
                addPickup(m_textures->WeaponWorld(), 0.55f, m_settings.weaponBobSpeed,
                          m_settings.weaponBobAmp);
                break;
            case Tile::Shotgun:
                addPickup(m_textures->Weapon2World(), 0.55f, m_settings.weaponBobSpeed,
                          m_settings.weaponBobAmp);
                break;
            case Tile::PortalGun:
                addPickup(m_textures->PortalGunWorld(), 0.55f, m_settings.weaponBobSpeed,
                          m_settings.weaponBobAmp);
                break;
            case Tile::Ammo:
                addPickup(m_textures->Ammo(), 0.40f, m_settings.ammoBobSpeed,
                          m_settings.ammoBobAmp, -0.05f);
                break;
            case Tile::Stairs:
                // Simple glowing marker
                if (m_textures->Exit().ready) {
                    sprites.push_back(Billboard{
                        .x = x + 0.5, .y = y + 0.5, .z = -0.2,
                        .tex = &m_textures->Exit(), .scale = 0.35f, .isExit = false,
                    });
                }
                break;
            default:
                break;
            }
        }
    }

    for (const Enemy& e : enemies.All()) {
        if (e.Floor() != floor) {
            continue;
        }
        const bool alive = e.IsAlive();
        const PixelTexture* tex =
            alive ? (m_textures->Enemy().ready ? &m_textures->Enemy() : nullptr)
                  : (m_textures->EnemyDead().ready ? &m_textures->EnemyDead() : nullptr);
        if (!tex) {
            continue;
        }
        sprites.push_back(Billboard{
            .x = e.X(),
            .y = e.Y(),
            .z = alive ? 0.0 : -0.15,
            .tex = tex,
            .scale = alive ? e.GetSettings().spriteScaleAlive
                           : e.GetSettings().spriteScaleDead,
            .isExit = false,
        });
    }

    std::sort(sprites.begin(), sprites.end(), [&](const Billboard& a, const Billboard& b) {
        const double da = (a.x - posX) * (a.x - posX) + (a.y - posY) * (a.y - posY);
        const double db = (b.x - posX) * (b.x - posX) + (b.y - posY) * (b.y - posY);
        return da > db;
    });

    const double invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (const Billboard& sp : sprites) {
        const double spriteX = sp.x - posX;
        const double spriteY = sp.y - posY;
        const double transformX = invDet * (dirY * spriteX - dirX * spriteY);
        const double transformY = invDet * (-planeY * spriteX + planeX * spriteY);
        if (transformY <= 0.05) {
            continue;
        }

        const int spriteScreenX =
            static_cast<int>((m_w / 2.0) * (1.0 + transformX / transformY));
        const int spriteHeight =
            std::abs(static_cast<int>(m_h / transformY * sp.scale));
        const int spriteWidth = spriteHeight;
        const int vMove =
            static_cast<int>(sp.z * m_h / transformY) + pitchPixels;

        int drawStartY = -spriteHeight / 2 + m_h / 2 + vMove;
        int drawEndY   = spriteHeight / 2 + m_h / 2 + vMove;
        int drawStartX = -spriteWidth / 2 + spriteScreenX;
        int drawEndX   = spriteWidth / 2 + spriteScreenX;
        drawStartY = std::max(drawStartY, 0);
        drawEndY   = std::min(drawEndY, m_h - 1);
        drawStartX = std::max(drawStartX, 0);
        drawEndX   = std::min(drawEndX, m_w - 1);

        const int texW = sp.tex->width;
        const int texH = sp.tex->height;

        for (int stripe = drawStartX; stripe < drawEndX; ++stripe) {
            if (transformY >= m_zBuffer[static_cast<std::size_t>(stripe)]) {
                continue;
            }
            const int texX =
                static_cast<int>(256 * (stripe - (-spriteWidth / 2 + spriteScreenX))
                                 * texW / spriteWidth)
                / 256;
            if (texX < 0 || texX >= texW) {
                continue;
            }
            for (int y = drawStartY; y < drawEndY; ++y) {
                const int d = (y - vMove) * 256 - m_h * 128 + spriteHeight * 128;
                const int texY = ((d * texH) / spriteHeight) / 256;
                if (texY < 0 || texY >= texH) {
                    continue;
                }
                Color sample = sp.tex->SamplePixel(texX, texY);
                if (sample.a < 10) {
                    continue;
                }
                if (sp.isExit) {
                    const float pulse =
                        0.85f + 0.15f * static_cast<float>(std::sin(timeSeconds * 2.5));
                    sample = Darken(sample, pulse);
                }
                sample = ApplyFog(sample, static_cast<float>(transformY));
                PutPixel(stripe, y, sample);
            }
        }
    }
}

void Raycaster::RenderViewmodel(const Player& player, int screenW, int screenH) const
{
    if (!m_textures) {
        return;
    }

    const float bobPhase = static_cast<float>(player.BobPhase());
    const float moveAmt  = static_cast<float>(player.MoveAmount());
    const float swayX =
        std::sin(bobPhase) * m_settings.handBobX * moveAmt
        + std::sin(bobPhase * 0.5f) * m_settings.handSway * moveAmt;
    const float swayY =
        std::abs(std::cos(bobPhase)) * m_settings.handBobY * moveAmt;
    const float idleY = std::sin(bobPhase * 0.35f) * 2.0f * (1.0f - moveAmt);
    const float pitchShift =
        static_cast<float>(player.Pitch()) * static_cast<float>(screenH) * 0.15f;

    float fireKick = 0.0f;
    if (player.IsFiring()) {
        float dur = player.GetSettings().fireAnimDuration;
        if (player.CurrentWeapon() == WeaponSlot::Shotgun) {
            dur = player.GetSettings().shotgunAnimDuration;
        }
        if (dur > 1e-4f) {
            const float t = 1.0f - (player.FireAnim() / dur);
            fireKick      = std::sin(t * 3.14159265f);
        }
    }

    const WeaponSlot wpn = player.CurrentWeapon();
    const Texture2D* tex = nullptr;
    float scale = m_settings.weaponScale;
    float baseXFrac = 0.52f;
    float baseYFrac = 0.92f;

    if (wpn == WeaponSlot::Pistol && m_textures->Weapon().ready) {
        tex   = &m_textures->Weapon().gpu;
        scale = m_settings.weaponScale;
    } else if (wpn == WeaponSlot::Shotgun && m_textures->Weapon2().ready) {
        tex   = &m_textures->Weapon2().gpu;
        scale = m_settings.shotgunScale;
    } else if (wpn == WeaponSlot::PortalGun && m_textures->PortalGun().ready) {
        tex   = &m_textures->PortalGun().gpu;
        scale = m_settings.portalGunScale;
    } else if (m_textures->Hand().ready) {
        tex   = &m_textures->Hand().gpu;
        scale = m_settings.handScale;
        baseXFrac = 0.55f;
        baseYFrac = 0.90f;
    } else {
        return;
    }

    const float gunW = static_cast<float>(tex->width) * scale;
    const float gunH = static_cast<float>(tex->height) * scale;
    const float baseX = static_cast<float>(screenW) * baseXFrac - gunW * 0.25f;
    const float baseY = static_cast<float>(screenH) - gunH * baseYFrac;

    const Vector2 pos{
        baseX + swayX - fireKick * m_settings.fireKickX,
        baseY + swayY + idleY + pitchShift + fireKick * m_settings.fireKickY,
    };

    // Portal gun: subtle blue/orange idle tint via draw color
    Color tint = WHITE;
    if (wpn == WeaponSlot::PortalGun) {
        tint = Color{200, 230, 255, 255};
    }
    DrawTextureEx(*tex, pos, fireKick * -4.0f, scale, tint);

    if (fireKick > 0.15f
        && (wpn == WeaponSlot::Pistol || wpn == WeaponSlot::Shotgun)) {
        const float fs = m_settings.muzzleFlashSize * (0.6f + 0.4f * fireKick);
        const float mx = pos.x + gunW * 0.92f;
        const float my = pos.y + gunH * 0.38f;
        DrawCircle(static_cast<int>(mx), static_cast<int>(my), fs,
                   Color{255, 220, 120, static_cast<unsigned char>(200 * fireKick)});
        DrawCircle(static_cast<int>(mx), static_cast<int>(my), fs * 0.45f,
                   Color{255, 255, 240, static_cast<unsigned char>(230 * fireKick)});
    }
}
