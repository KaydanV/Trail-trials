/** Collision boundaries follow the painted buildings, including center-cropped phone views. */
const families = {
  welcome: { width:1536, height:1024, solid:[[21,16,71,49]] },
  workshop: { width:1536, height:1024, solid:[[7,12,74,44]] },
  archive: { width:1536, height:1024, solid:[[22,12,73,49]] },
  observatory: { width:1536, height:1024, solid:[[24,8,64,46]] },
  portrait: { width:1024, height:1536, solid:[[18,12,84,40]] },
};
export function sceneFamily(scene) {
  if (['desk','maps'].includes(scene)) return 'workshop';
  if (['owl','burrow','post'].includes(scene)) return 'archive';
  if (scene === 'welcome') return 'welcome';
  return 'observatory';
}
export function paintedObstacles(scene, width, height, projection) {
  if (!(width > 0 && height > 0 && projection.scale > 0)) return [];
  const family = scene === 'welcome' && width <= 760 && height > width ? families.portrait : families[sceneFamily(scene)];
  const scale = Math.max(width / family.width, height / family.height);
  const imageWidth = family.width * scale, imageHeight = family.height * scale;
  const offsetX = (width - imageWidth) / 2, offsetY = (height - imageHeight) / 2;
  return family.solid.map(([left,top,right,bottom]) => ({
    left:(offsetX + left / 100 * imageWidth) / width * 100,
    right:(offsetX + right / 100 * imageWidth) / width * 100,
    top:((offsetY + top / 100 * imageHeight) / height * 100 - projection.offset) / projection.scale,
    bottom:((offsetY + bottom / 100 * imageHeight) / height * 100 - projection.offset) / projection.scale,
  }));
}
