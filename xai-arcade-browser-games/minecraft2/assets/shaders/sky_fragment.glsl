#version 330 core
in vec3 vDir;
uniform vec3 uSkyColor;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
out vec4 FragColor;
void main(){
    vec3 d = normalize(vDir);
    vec3 col = uSkyColor;
    // sun disc
    float sun = pow(max(dot(d, normalize(uSunDir)), 0.0), 256.0);
    col += vec3(1.0, 0.95, 0.7) * sun * 1.5;
    // moon disc
    float moon = pow(max(dot(d, normalize(uMoonDir)), 0.0), 512.0);
    col += vec3(0.8, 0.85, 1.0) * moon;
    FragColor = vec4(col, 1.0);
}
