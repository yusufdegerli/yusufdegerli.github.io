#version 330 core
in vec2 vTexCoord;
in float vAO;
in vec3 vWorldPos;

uniform sampler2D uTexture;
uniform vec3 uSkyColor;
uniform vec3 uSunDir;
uniform float uAmbient;

out vec4 FragColor;

void main() {
    vec4 tex = texture(uTexture, vTexCoord);
    if (tex.a < 0.1) discard;

    // Corner ambient occlusion darkening
    float ao = clamp(vAO, 0.0, 1.0);
    vec3 color = tex.rgb * ao;

    // Simple directional daylight
    float day = clamp(uSunDir.y * 0.5 + 0.5, 0.15, 1.0);
    color *= (uAmbient + day * 0.55);

    // Horizon haze
    float fog = smoothstep(80.0, 220.0, length(vWorldPos.xz));
    color = mix(color, uSkyColor, fog * 0.35);

    FragColor = vec4(color, tex.a);
}
