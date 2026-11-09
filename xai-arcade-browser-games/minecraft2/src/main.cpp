// Minecraft2 v0.3 — full systems (arm64 / OpenGL 3.3)
#include "minecraft2/core/SimulationThread.hpp"
#include "minecraft2/entity/Entities.hpp"
#include "minecraft2/math/Frustum.hpp"
#include "minecraft2/math/Raycast.hpp"
#include "minecraft2/physics/Physics.hpp"
#include "minecraft2/render/Camera.hpp"
#include "minecraft2/render/Shader.hpp"
#include "minecraft2/render/Texture.hpp"
#include "minecraft2/ui/Chat.hpp"
#include "minecraft2/ui/UI.hpp"
#include "minecraft2/world/World.hpp"

#include <glad/gl.h>
#define GLFW_INCLUDE_NONE
#include <GLFW/glfw3.h>

#include <cmath>
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

namespace fs = std::filesystem;
namespace {

constexpr int kW = 1280, kH = 720;
constexpr float kReach = 6.f;
constexpr int kRenderDist = 5;
constexpr int kSeed = 1337;

struct App {
    mc2::Camera* camera = nullptr;
    mc2::World* world = nullptr;
    mc2::PlayerState* player = nullptr;
    mc2::ChatSystem* chat = nullptr;
    mc2::UISystem* ui = nullptr;
    float aspect = 16.f/9.f;
    float worldTime = 1000.f; // day
    bool jumpEdge = false;
    bool wireframe = false;
} g;

void errCb(int c, const char* d){ std::cerr<<"[GLFW] "<<c<<" "<<(d?d:"")<<"\n"; }
void fbCb(GLFWwindow*, int w, int h){
    if(w<=0||h<=0) return;
    glViewport(0,0,w,h);
    g.aspect = float(w)/float(h);
}
void cursorCb(GLFWwindow*, double x, double y){
    if (g.chat && g.chat->open) return;
    if (g.player && g.player->inventoryOpen) return;
    if (g.ui && g.ui->screen() != mc2::GameScreen::Playing) return;
    if (!g.camera) return;
    g.camera->processMouseMovement(x,y);
    if (g.player) {
        g.player->yaw = g.camera->yaw();
        g.player->pitch = g.camera->pitch();
    }
}
void charCb(GLFWwindow*, unsigned int cp){
    if (g.chat) g.chat->handleChar(cp);
}
void mouseBtn(GLFWwindow*, int button, int action, int){
    if (!g.world || !g.camera || !g.player) return;
    if (g.ui && g.ui->screen() != mc2::GameScreen::Playing) return;
    if (g.chat && g.chat->open) return;
    if (g.player->inventoryOpen) return;
    if (action != GLFW_PRESS) return;
    const auto hit = mc2::raycastDDA(*g.world, g.camera->position(), g.camera->front(), kReach);
    if (!hit.hit) return;
    if (button == GLFW_MOUSE_BUTTON_LEFT) {
        g.world->breakBlock(hit.blockX, hit.blockY, hit.blockZ);
    } else if (button == GLFW_MOUSE_BUTTON_RIGHT) {
        const auto& p = g.player->body.position;
        const int px=(int)std::floor(p.x), py=(int)std::floor(p.y), pz=(int)std::floor(p.z);
        if (hit.prevX==px && hit.prevZ==pz && (hit.prevY==py||hit.prevY==py+1)) return;
        g.world->placeBlock(hit.prevX, hit.prevY, hit.prevZ, g.player->selectedBlock());
    }
}
void keyCb(GLFWwindow* win, int key, int, int action, int mods){
    if (g.chat && g.world && g.player) {
        if (g.chat->handleKey(key, action, mods, *g.player, *g.world, g.worldTime))
            return;
    }
    if (action != GLFW_PRESS) return;
    if (key == GLFW_KEY_ESCAPE) {
        if (g.player && g.player->inventoryOpen) { g.player->inventoryOpen=false; return; }
        if (g.ui && g.ui->screen()==mc2::GameScreen::Playing) {
            g.ui->setScreen(mc2::GameScreen::MainMenu);
            glfwSetInputMode(win, GLFW_CURSOR, GLFW_CURSOR_NORMAL);
            return;
        }
        glfwSetWindowShouldClose(win, 1);
    }
    if (key == GLFW_KEY_E && g.player) {
        g.player->inventoryOpen = !g.player->inventoryOpen;
        glfwSetInputMode(win, GLFW_CURSOR,
            g.player->inventoryOpen ? GLFW_CURSOR_NORMAL : GLFW_CURSOR_DISABLED);
    }
    if (key == GLFW_KEY_F1) {
        g.wireframe = !g.wireframe;
        glPolygonMode(GL_FRONT_AND_BACK, g.wireframe ? GL_LINE : GL_FILL);
    }
    if (key >= GLFW_KEY_1 && key <= GLFW_KEY_9 && g.player)
        g.player->selectedSlot = key - GLFW_KEY_1;
    if (key == GLFW_KEY_SPACE && action == GLFW_PRESS) g.jumpEdge = true;
}

std::string findAsset(const std::string& rel, const char* argv0){
    std::vector<fs::path> c;
    auto add=[&](fs::path p){c.push_back(p);};
    add(fs::current_path()/rel);
    add(fs::current_path()/"assets"/rel);
    add(fs::current_path()/".."/"assets"/rel);
    if (argv0) {
        std::error_code ec;
        auto d=fs::absolute(fs::path(argv0),ec).parent_path();
        if(!ec){ add(d/"assets"/rel); add(d/".."/"assets"/rel); }
    }
    for (auto& p:c){ std::error_code ec; if(fs::is_regular_file(p,ec)) return p.lexically_normal().string(); }
    return rel;
}

// Unit cube for entities / sky
unsigned int makeCubeVAO(){
    float v[] = {
        // 36 verts cube 0..1
        0,0,0, 1,0,0, 1,1,0, 0,0,0, 1,1,0, 0,1,0, // -Z
        0,0,1, 1,1,1, 1,0,1, 0,0,1, 0,1,1, 1,1,1, // +Z
        0,0,0, 0,1,1, 0,0,1, 0,0,0, 0,1,0, 0,1,1, // -X
        1,0,0, 1,0,1, 1,1,1, 1,0,0, 1,1,1, 1,1,0, // +X
        0,0,0, 1,0,1, 1,0,0, 0,0,0, 0,0,1, 1,0,1, // -Y
        0,1,0, 1,1,0, 1,1,1, 0,1,0, 1,1,1, 0,1,1, // +Y
    };
    // expand to -1..1 for sky sphere-ish cube
    unsigned vao,vbo;
    glGenVertexArrays(1,&vao);
    glGenBuffers(1,&vbo);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER,vbo);
    glBufferData(GL_ARRAY_BUFFER,sizeof(v),v,GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,3*sizeof(float),nullptr);
    glBindVertexArray(0);
    return vao;
}

void drawCube(unsigned vao, const mc2::Shader& sh, const mc2::Mat4& model, const mc2::Vec3& color){
    sh.use();
    sh.setMat4("model", model);
    sh.setVec3("uColor", color);
    glBindVertexArray(vao);
    glDrawArrays(GL_TRIANGLES, 0, 36);
    glBindVertexArray(0);
}

void updatePlayer(GLFWwindow* win, mc2::PlayerState& player, mc2::Camera& cam, mc2::World& world, float dt){
    const bool creative = player.mode == mc2::GameMode::Creative;
    const bool sprint = glfwGetKey(win, GLFW_KEY_LEFT_SHIFT)==GLFW_PRESS;
    float speed = creative ? mc2::PhysicsConfig::FlySpeed
                           : (sprint ? mc2::PhysicsConfig::SprintSpeed : mc2::PhysicsConfig::WalkSpeed);
    if (player.food <= 0.f && !creative) speed *= 0.5f;

    const float yawR = player.yaw * (3.14159265f/180.f);
    const mc2::Vec3 forward{std::cos(yawR), 0.f, std::sin(yawR)};
    const mc2::Vec3 right{std::cos(yawR+1.5707963f), 0.f, std::sin(yawR+1.5707963f)};

    mc2::Vec3 wish{0,0,0};
    if (glfwGetKey(win, GLFW_KEY_W)==GLFW_PRESS) wish += forward;
    if (glfwGetKey(win, GLFW_KEY_S)==GLFW_PRESS) wish -= forward;
    if (glfwGetKey(win, GLFW_KEY_A)==GLFW_PRESS) wish -= right;
    if (glfwGetKey(win, GLFW_KEY_D)==GLFW_PRESS) wish += right;

    if (wish.length() > 1e-4f) {
        wish = wish.normalized() * speed;
        player.body.velocity.x = wish.x;
        player.body.velocity.z = wish.z;
    } else {
        player.body.velocity.x *= creative ? 0.8f : 0.6f;
        player.body.velocity.z *= creative ? 0.8f : 0.6f;
    }

    if (creative) {
        player.body.velocity.y = 0.f;
        if (glfwGetKey(win, GLFW_KEY_SPACE)==GLFW_PRESS) player.body.velocity.y = speed;
        if (glfwGetKey(win, GLFW_KEY_LEFT_CONTROL)==GLFW_PRESS) player.body.velocity.y = -speed;
        player.body.noClip = false;
        // still collide in creative but no gravity
        applyGravityAndJump(player.body, false, true, dt);
    } else {
        const bool jump = g.jumpEdge;
        g.jumpEdge = false;
        applyGravityAndJump(player.body, jump, false, dt);
    }

    moveAndCollide(world, player.body, dt);

    // hunger drain while sprinting
    if (!creative && sprint && wish.length()>0.1f)
        player.food = std::max(0.f, player.food - dt * 0.4f);

    cam.setPosition(mc2::eyePosition(player.body));
    cam.setYawPitch(player.yaw, player.pitch);
}

} // namespace

int main(int argc, char** argv){
    std::cout.setf(std::ios::unitbuf);
    std::cout << "Minecraft2 v0.3.0 — systems build (arm64)\n";

    glfwSetErrorCallback(errCb);
    if (!glfwInit()) return 1;
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR,3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR,3);
    glfwWindowHint(GLFW_OPENGL_PROFILE,GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT,GLFW_TRUE);
#ifdef __APPLE__
    glfwWindowHint(GLFW_COCOA_RETINA_FRAMEBUFFER,GLFW_TRUE);
#endif
    GLFWwindow* win = glfwCreateWindow(kW,kH,"Minecraft2",nullptr,nullptr);
    if(!win){ glfwTerminate(); return 1; }
    glfwMakeContextCurrent(win);
    glfwSwapInterval(1);
    glfwSetFramebufferSizeCallback(win, fbCb);
    glfwSetCursorPosCallback(win, cursorCb);
    glfwSetMouseButtonCallback(win, mouseBtn);
    glfwSetKeyCallback(win, keyCb);
    glfwSetCharCallback(win, charCb);

    if (!gladLoadGL(glfwGetProcAddress)) { std::cerr<<"GLAD fail\n"; return 1; }
    int fbw,fbh; glfwGetFramebufferSize(win,&fbw,&fbh);
    glViewport(0,0,fbw,fbh); g.aspect = float(fbw)/float(fbh);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_CULL_FACE);
    glCullFace(GL_BACK);
    glFrontFace(GL_CCW);

    const char* a0 = argc?argv[0]:nullptr;
    auto asset=[&](const char* r){ return findAsset(r,a0); };

    mc2::Shader chunkShader, entityShader, skyShader;
    if (!chunkShader.loadFromFiles(asset("shaders/vertex.glsl"), asset("shaders/fragment.glsl"))) return 1;
    if (!entityShader.loadFromFiles(asset("shaders/entity_vertex.glsl"), asset("shaders/entity_fragment.glsl"))) return 1;
    if (!skyShader.loadFromFiles(asset("shaders/sky_vertex.glsl"), asset("shaders/sky_fragment.glsl"))) return 1;

    mc2::Texture terrain;
    if (!terrain.loadFromFile(asset("textures/terrain.png"), true)) return 1;

    unsigned cubeVAO = makeCubeVAO();
    // Sky uses large cube centered at 0 — positions 0..1, we'll scale in model

    {
        mc2::UISystem ui;
        if (!ui.init()) { std::cerr<<"UI init fail\n"; return 1; }
        g.ui = &ui;

        mc2::ChatSystem chat;
        g.chat = &chat;
        chat.addMessage("Welcome to Minecraft2! Press ENTER to play. T for chat, /help");

        mc2::PlayerState player;
        player.body.position = {8.f, 90.f, 8.f};
        g.player = &player;

        mc2::Camera camera(mc2::eyePosition(player.body));
        camera.setYawPitch(player.yaw, player.pitch);
        g.camera = &camera;

        mc2::World world(kSeed, kRenderDist);
        g.world = &world;

        mc2::EntitySystem entities;
        mc2::SimulationThread sim(world, entities);
        sim.start();

        float last = (float)glfwGetTime();
        double mx,my; glfwGetCursorPos(win,&mx,&my); camera.resetMouse(mx,my);

        while (!glfwWindowShouldClose(win)) {
            float now=(float)glfwGetTime();
            float dt=now-last; last=now;
            if (dt>0.1f) dt=0.1f;
            glfwPollEvents();
            glfwGetFramebufferSize(win,&fbw,&fbh);
            if (fbh>0) g.aspect=float(fbw)/float(fbh);

            if (ui.screen() == mc2::GameScreen::MainMenu) {
                sim.setEnabled(false);
                glClearColor(0.1f,0.12f,0.15f,1);
                glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);
                ui.drawMenu(fbw, fbh);
                if (ui.updateMenu(win, fbw, fbh)) {
                    ui.setScreen(mc2::GameScreen::Playing);
                    glfwSetInputMode(win, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
                    glfwGetCursorPos(win,&mx,&my); camera.resetMouse(mx,my);
                    chat.addMessage("Entered world. /gamemode 1 for creative.");
                    sim.setEnabled(true);
                }
                glfwSwapBuffers(win);
                continue;
            }

            // --- Playing: RENDER THREAD only (input + GL). Logic is on sim @ 20 TPS. ---
            sim.setEnabled(true);

            if (!chat.open && !player.inventoryOpen)
                updatePlayer(win, player, camera, world, dt);

            // Publish player sample for zombie AI; pull damage from last ticks
            sim.publishPlayer(player);
            sim.drainPlayerEffects(player);

            // Chunk streaming + GPU mesh upload stay on the GL thread
            world.update(player.body.position);
            world.pumpMainThread();

            // Visual-only day cycle (not a logic tick)
            g.worldTime = std::fmod(g.worldTime + dt * 20.f, 24000.f);

            chat.update(dt);

            // Sky color
            const mc2::Vec3 sky = mc2::skyColorForTime(g.worldTime);
            mc2::Vec3 sunDir, moonDir;
            mc2::sunMoonDirection(g.worldTime, sunDir, moonDir);
            glClearColor(sky.x, sky.y, sky.z, 1.f);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

            const mc2::Mat4 view = camera.viewMatrix();
            const mc2::Mat4 proj = camera.projectionMatrix(g.aspect);
            const mc2::Mat4 vp = proj * view;
            const mc2::Frustum frustum = mc2::Frustum::fromViewProjection(vp);

            // Skybox
            glDepthFunc(GL_LEQUAL);
            glDisable(GL_CULL_FACE);
            skyShader.use();
            skyShader.setMat4("view", view);
            skyShader.setMat4("projection", proj);
            skyShader.setVec3("uSkyColor", sky);
            skyShader.setVec3("uSunDir", sunDir);
            skyShader.setVec3("uMoonDir", moonDir);
            // Draw unit cube expanded
            // Rebuild sky as simple NDC cube in shader using positions -1..1
            // Quick fix: use expanded positions by drawing with vertex shader only view rot
            // Upload alternate: use entity cube with modified verts — draw  unit cube from -1..1
            static unsigned skyVAO=0;
            if (!skyVAO) {
                float sv[]={
                    -1,-1,-1, 1,-1,-1, 1,1,-1, -1,-1,-1, 1,1,-1, -1,1,-1,
                    -1,-1,1, 1,1,1, 1,-1,1, -1,-1,1, -1,1,1, 1,1,1,
                    -1,-1,-1, -1,1,1, -1,-1,1, -1,-1,-1, -1,1,-1, -1,1,1,
                    1,-1,-1, 1,-1,1, 1,1,1, 1,-1,-1, 1,1,1, 1,1,-1,
                    -1,-1,-1, 1,-1,1, 1,-1,-1, -1,-1,-1, -1,-1,1, 1,-1,1,
                    -1,1,-1, 1,1,-1, 1,1,1, -1,1,-1, 1,1,1, -1,1,1
                };
                unsigned vbo;
                glGenVertexArrays(1,&skyVAO);
                glGenBuffers(1,&vbo);
                glBindVertexArray(skyVAO);
                glBindBuffer(GL_ARRAY_BUFFER,vbo);
                glBufferData(GL_ARRAY_BUFFER,sizeof(sv),sv,GL_STATIC_DRAW);
                glEnableVertexAttribArray(0);
                glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,3*sizeof(float),nullptr);
                glBindVertexArray(0);
            }
            glBindVertexArray(skyVAO);
            glDrawArrays(GL_TRIANGLES,0,36);
            glBindVertexArray(0);
            glEnable(GL_CULL_FACE);
            glDepthFunc(GL_LESS);

            // Chunks with frustum culling
            chunkShader.use();
            chunkShader.setMat4("view", view);
            chunkShader.setMat4("projection", proj);
            chunkShader.setInt("uTexture", 0);
            chunkShader.setVec3("uSkyColor", sky);
            chunkShader.setVec3("uSunDir", sunDir);
            chunkShader.setFloat("uAmbient", 0.45f);
            terrain.bind(0);
            world.draw(chunkShader, &frustum);

            // Entities
            entityShader.use();
            entityShader.setMat4("view", view);
            entityShader.setMat4("projection", proj);
            for (const auto& e : sim.entitySnapshot()) {
                mc2::Mat4 model = mc2::Mat4::translate({e.pos.x - e.w*0.5f, e.pos.y, e.pos.z - e.d*0.5f})
                    * mc2::Mat4::scale({e.w, e.h, e.d});
                drawCube(cubeVAO, entityShader, model, {e.r,e.g,e.b});
            }

            // Sun / moon billboards (simple cubes far away)
            {
                const mc2::Vec3 eye = camera.position();
                const mc2::Vec3 sunPos = eye + sunDir * 200.f;
                const mc2::Vec3 moonPos = eye + moonDir * 200.f;
                drawCube(cubeVAO, entityShader,
                    mc2::Mat4::translate({sunPos.x-4,sunPos.y-4,sunPos.z-4})*mc2::Mat4::scale({8,8,8}),
                    {1.f,0.95f,0.6f});
                drawCube(cubeVAO, entityShader,
                    mc2::Mat4::translate({moonPos.x-3,moonPos.y-3,moonPos.z-3})*mc2::Mat4::scale({6,6,6}),
                    {0.85f,0.88f,1.f});
            }

            // UI orthographic overlay
            ui.drawHUD(fbw, fbh, player, chat, g.worldTime);
            ui.drawInventory(fbw, fbh, player);

            // Title
            std::ostringstream title;
            title << "Minecraft2 | chunk ("<<world.playerChunkX()<<','<<world.playerChunkZ()
                  <<") | "<<world.loadedChunkCount()<<" chunks | HP "<<(int)player.health
                  <<" | time "<<(int)g.worldTime
                  <<" | simTick "<<sim.tickCount();
            glfwSetWindowTitle(win, title.str().c_str());

            if (player.health <= 0.f) {
                chat.addMessage("You died! Respawning...");
                player.health = player.maxHealth;
                player.food = player.maxFood;
                player.body.position = {8.f, 100.f, 8.f};
                player.body.velocity = {};
            }

            glfwSwapBuffers(win);
        }

        sim.setEnabled(false);
        sim.stop();
        g.camera=nullptr; g.world=nullptr; g.player=nullptr; g.chat=nullptr; g.ui=nullptr;
        ui.shutdown();
    }

    glfwDestroyWindow(win);
    glfwTerminate();
    return 0;
}
