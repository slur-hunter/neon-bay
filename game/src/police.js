// The wanted system: stars 0 to 4, named cruisers that respond, roles from live
// distance (RAMMING under 7 metres, PURSUIT under 30, RESPONDING beyond), flashing
// light bars, and wanted that fades when the player stays out of sight.
import { WANTED_MAX, WORLD } from './config.js';
import { clamp } from './util.js';

export function createPolice(actors) {
  let wanted = 0;
  let heat = 0;
  let calmTime = 0;

  function roleFor(distance) {
    if (distance < 7) return 'RAMMING';
    if (distance < 30) return 'PURSUIT';
    return 'RESPONDING';
  }

  return {
    get wanted() {
      return wanted;
    },
    get heat() {
      return heat;
    },

    setWanted(level) {
      wanted = clamp(level, 0, WANTED_MAX);
      heat = wanted * 25;
      for (const cruiser of actors.cruisers) {
        cruiser.active = wanted > 0;
        cruiser.mesh.visible = wanted > 0;
      }
    },

    raise(amount) {
      this.setWanted(wanted + amount);
    },

    /** Steal a car in view of the law: wanted 1 and the cruisers roll in. */
    onSteal() {
      this.setWanted(Math.max(wanted, 1));
    },

    /** Punching a police car draws heat. Punching a pedestrian never does. */
    onPunchCruiser() {
      this.raise(1);
    },

    /** Recompute roles and distances and flash the light bars without moving the
        cruisers: a staged shot keeps its exact framing while staying live. */
    flash(dt, time) {
      const player = actors.player;
      for (const cruiser of actors.cruisers) {
        if (!cruiser.active) continue;
        cruiser.distance = Math.hypot(player.x - cruiser.x, player.z - cruiser.z);
        cruiser.role = roleFor(cruiser.distance);
        const bar = cruiser.mesh.userData.lightBar;
        if (bar) {
          const phase = Math.floor(time * 6) % 2 === 0;
          bar.userData.red.material.color.setHex(phase ? 0xff2222 : 0x550000);
          bar.userData.blue.material.color.setHex(phase ? 0x112266 : 0x2266ff);
        }
      }
    },

    step(dt, time) {
      const player = actors.player;
      let nearest = Infinity;
      for (const cruiser of actors.cruisers) {
        if (!cruiser.active) {
          cruiser.distance = 99;
          cruiser.role = 'RESPONDING';
          continue;
        }
        const dx = player.x - cruiser.x;
        const dz = player.z - cruiser.z;
        const distance = Math.hypot(dx, dz);
        cruiser.distance = distance;
        cruiser.role = roleFor(distance);
        if (distance < nearest) nearest = distance;
        // Chase: steer toward the player, faster when closer.
        const targetHeading = Math.atan2(dx, dz);
        let diff = targetHeading - cruiser.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cruiser.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
        const speed = distance > 40 ? 24 : distance > 12 ? 17 : 11;
        cruiser.speed = speed;
        cruiser.x += Math.sin(cruiser.heading) * speed * dt;
        cruiser.z += Math.cos(cruiser.heading) * speed * dt;
        cruiser.x = clamp(cruiser.x, WORLD.westEnd + 4, WORLD.oceanX0 - 16);
        cruiser.z = clamp(cruiser.z, WORLD.northEnd + 6, WORLD.southEnd - 6);
        cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
        cruiser.mesh.rotation.y = cruiser.heading;
        // Light bar flashes red and blue, alternating with time.
        const bar = cruiser.mesh.userData.lightBar;
        if (bar) {
          const phase = Math.floor(time * 6) % 2 === 0;
          bar.userData.red.material.color.setHex(phase ? 0xff2222 : 0x550000);
          bar.userData.blue.material.color.setHex(phase ? 0x112266 : 0x2266ff);
        }
      }
      // Wanted fades after 25 seconds with no cruiser close by.
      if (wanted > 0 && nearest > 55) {
        calmTime += dt;
        if (calmTime > 25) {
          wanted -= 1;
          heat = wanted * 25;
          calmTime = 0;
          if (wanted === 0) {
            for (const cruiser of actors.cruisers) {
              cruiser.active = false;
              cruiser.mesh.visible = false;
            }
          }
        }
      } else {
        calmTime = 0;
      }
    },

    /** Place the cruisers around the player for a staged chase, all in frame. */
    stageChase() {
      const player = actors.player;
      const offsets = [
        [-3, 3],
        [6, 14],
        [-6, 10],
        [6, -6],
      ];
      actors.cruisers.forEach((cruiser, i) => {
        cruiser.active = true;
        cruiser.mesh.visible = true;
        cruiser.x = player.x + offsets[i][0];
        cruiser.z = player.z + offsets[i][1];
        cruiser.heading = Math.PI;
        cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
        cruiser.mesh.rotation.y = cruiser.heading;
        cruiser.distance = Math.hypot(offsets[i][0], offsets[i][1]);
        cruiser.role = roleFor(cruiser.distance);
      });
      wanted = 4;
      heat = 100;
    },
  };
}
