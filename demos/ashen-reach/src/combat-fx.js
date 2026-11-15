import { createBladeFx } from './vfx-blade.js';
import { createGaleFx } from './vfx-gale.js';
import { createQuakeFx } from './vfx-quake.js';
import { createImpactFx } from './vfx-impact.js';

export const GALE_RADIUS = 5.2;
export const quakeRadius = rank => 4.2 + rank * .5;

// Both the field and the model viewer sample the posed weapon in world space.
export function createCombatFx(T, scene, hero, heightAt) {
  const blade = createBladeFx(T, scene);
  const gale = createGaleFx(T, scene);
  const quake = createQuakeFx(T, scene, heightAt);
  const impact = createImpactFx(T, scene);
  const origin = new T.Vector3();
  return {
    update(dt, action, armed) {
      blade.update(dt, action, armed ? hero.bladeBase : null, armed ? hero.bladeTip : null);
      gale.update(dt);
      quake.update(dt);
      impact.update(dt);
    },
    release(kind, yaw, radius, armed) {
      if (kind === 'gale') {
        hero.root.getWorldPosition(origin);
        gale.strike(origin, yaw, radius);
      } else if (kind === 'quake') {
        if (armed && hero.bladeTip) hero.bladeTip.getWorldPosition(origin);
        else {
          hero.root.getWorldPosition(origin);
          origin.x += Math.sin(yaw) * .9;
          origin.z -= Math.cos(yaw) * .9;
        }
        origin.y = heightAt(origin.x, origin.z);
        quake.strike(origin, yaw, radius);
      }
    },
    hit: impact.hit,
    reset() { blade.reset(); gale.reset(); quake.reset(); impact.reset(); },
    dispose() { blade.dispose(); gale.dispose(); quake.dispose(); impact.dispose(); }
  };
}
