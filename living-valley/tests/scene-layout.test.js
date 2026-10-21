import test from 'node:test';
import assert from 'node:assert/strict';
import {paintedObstacles} from '../scene-layout.js';
import {WALK_BOUNDS,isWalkable,walkablePoint,planWalk,clearWalkSegment} from '../play-controller.js';

test('painted scenery leaves a reachable courtyard and routes around solid buildings after resizing', () => {
  const scenes=['welcome','desk','maps','owl','burrow','lantern','keeper','post','bridge','lookout','tower','summit'];
  for(const [width,height] of [[1440,900],[390,844],[320,740],[844,390]]) {
    const narrow=width<=760,short=height<=560;
    const range=narrow?{top:28,bottom:64}:short?{top:29,bottom:69}:{top:36,bottom:79};
    const scale=(range.bottom-range.top)/(WALK_BOUNDS.bottom-WALK_BOUNDS.top);
    const projection={scale,offset:range.top-WALK_BOUNDS.top*scale};
    for(const scene of scenes) {
      const obstacles=paintedObstacles(scene,width,height,projection);
      assert.ok(obstacles.length,scene+' has building collision');
      for(const rect of obstacles) {
        assert.ok(Object.values(rect).every(Number.isFinite));
        assert.ok(rect.left<rect.right && rect.top<rect.bottom);
        const roof={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2};
        const safe=walkablePoint(roof,obstacles);
        assert.ok(safe && isWalkable(safe,obstacles),scene+' projects roof clicks back to the trail');
      }
      const start={x:10,y:86},goal={x:90,y:86};
      assert.ok(isWalkable(start,obstacles) && isWalkable(goal,obstacles),scene+' keeps the courtyard clear');
      const route=planWalk(start,goal,obstacles,WALK_BOUNDS,width/(height*scale));
      assert.ok(route.length,scene+' courtyard remains connected');
      let before=start;
      for(const waypoint of route) {assert.ok(clearWalkSegment(before,waypoint,obstacles));before=waypoint;}
    }
  }
});
