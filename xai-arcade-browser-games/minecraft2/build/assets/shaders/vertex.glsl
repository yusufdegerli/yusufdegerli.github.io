#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;
layout (location = 2) in float aAO;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

out vec2 vTexCoord;
out float vAO;
out vec3 vWorldPos;

void main() {
    vec4 world = model * vec4(aPos, 1.0);
    vWorldPos = world.xyz;
    vTexCoord = aTexCoord;
    vAO = aAO;
    gl_Position = projection * view * world;
}
