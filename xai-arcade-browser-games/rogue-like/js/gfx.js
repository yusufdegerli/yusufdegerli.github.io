export function ensureRectTexture(scene, key, w, h, color = 0xffffff) {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(color, 1);
  g.fillRect(0, 0, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}
