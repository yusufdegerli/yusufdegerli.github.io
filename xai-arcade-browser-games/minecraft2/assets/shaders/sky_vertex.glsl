#version 330 core
layout(location=0) in vec3 aPos;
uniform mat4 view;
uniform mat4 projection;
out vec3 vDir;
void main(){
    vDir = aPos;
    mat4 v = mat4(mat3(view)); // remove translation
    vec4 clip = projection * v * vec4(aPos, 1.0);
    gl_Position = clip.xyww; // depth = 1
}
