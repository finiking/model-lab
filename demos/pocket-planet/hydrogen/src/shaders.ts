import * as THREE from 'three';

export function createPlanetTerrainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.7, 0.55, 0.45).normalize() },
      uSpring: { value: 0.25 },
      uIce: { value: 0.0 },
      uNight: { value: 0.0 },
      uCraters: {
        value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 1, 0, 0)),
      },
      uCraterAges: { value: [0, 0, 0, 0, 0, 0] },
    },
    vertexShader: /* glsl */ `
      attribute float aElev;
      attribute float aMoisture;

      uniform float uTime;
      uniform vec4 uCraters[6];
      uniform float uCraterAges[6];

      varying vec3 vWorldNormal;
      varying vec3 vLocalDir;
      varying vec3 vWorldPos;
      varying float vElev;
      varying float vMoisture;
      varying float vCraterHeat;
      varying float vCraterRim;

      void main() {
        vec3 dir = normalize(position);
        float r = length(position);

        float craterDisp = 0.0;
        float heat = 0.0;
        float rimMask = 0.0;

        for (int i = 0; i < 6; i++) {
          float cInt = uCraters[i].w;
          if (cInt > 0.01) {
            float d = acos(clamp(dot(dir, normalize(uCraters[i].xyz)), -1.0, 1.0));
            float radius = 0.21;
            if (d < radius * 1.75) {
              float t = d / radius;
              if (t < 1.0) {
                float bowl = (1.0 - t * t);
                craterDisp -= bowl * 0.068 * min(1.0, cInt * 1.4);
                heat = max(heat, bowl * cInt * 1.25);
              }
              float rim = exp(-pow((t - 1.04) * 3.6, 2.0));
              craterDisp += rim * 0.032 * min(1.0, cInt * 1.3);
              rimMask = max(rimMask, rim * cInt);
            }
          }
        }

        vec3 displaced = dir * max(0.88, r + craterDisp);
        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vLocalDir = dir;
        vElev = aElev + craterDisp;
        vMoisture = aMoisture;
        vCraterHeat = clamp(heat, 0.0, 1.2);
        vCraterRim = clamp(rimMask, 0.0, 1.0);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uSpring;
      uniform float uIce;
      uniform float uNight;
      uniform vec4 uCraters[6];

      varying vec3 vWorldNormal;
      varying vec3 vLocalDir;
      varying vec3 vWorldPos;
      varying float vElev;
      varying float vMoisture;
      varying float vCraterHeat;
      varying float vCraterRim;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
              mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
              mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      void main() {
        // Tactile miniature facet blending: subtle geometric bevel feel
        vec3 dpdx = dFdx(vWorldPos);
        vec3 dpdy = dFdy(vWorldPos);
        vec3 faceN = normalize(cross(dpdx, dpdy));
        vec3 N = normalize(mix(normalize(vWorldNormal), faceN, 0.38));
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        float lat = abs(vLocalDir.y);
        float h = vElev - 1.0;

        // Multi-biome miniature enamel palette
        vec3 sandCol = vec3(0.88, 0.77, 0.56);
        vec3 lushGreen = mix(vec3(0.18, 0.58, 0.36), vec3(0.22, 0.78, 0.44), uSpring);
        vec3 blossomTint = vec3(0.95, 0.56, 0.72);
        vec3 highlandCol = vec3(0.36, 0.46, 0.34);
        vec3 rockCol = vec3(0.45, 0.43, 0.48);
        vec3 snowCol = vec3(0.94, 0.97, 1.0);
        vec3 seabedCol = vec3(0.08, 0.32, 0.38);

        float micro = noise3(vLocalDir * 24.0);
        vec3 baseCol = seabedCol;

        if (h > -0.008) {
          float beachMix = smoothstep(-0.006, 0.012, h);
          baseCol = mix(seabedCol, sandCol, beachMix);

          float meadowMix = smoothstep(0.010, 0.028, h);
          vec3 meadow = mix(lushGreen, vec3(0.42, 0.72, 0.32), 1.0 - vMoisture);
          // Spring blossom pockets
          float blossomMask = smoothstep(0.58, 0.85, micro) * uSpring * smoothstep(0.015, 0.075, h) * (1.0 - smoothstep(0.08, 0.12, h));
          meadow = mix(meadow, blossomTint, blossomMask * 0.58);
          baseCol = mix(baseCol, meadow, meadowMix);

          float hillMix = smoothstep(0.065, 0.105, h);
          baseCol = mix(baseCol, mix(highlandCol, rockCol, smoothstep(0.08, 0.13, h)), hillMix);

          float snowLine = mix(0.122, 0.055, clamp(lat * 0.85 + uIce * 0.65, 0.0, 1.0));
          float snowMix = smoothstep(snowLine, snowLine + 0.024, h + uIce * 0.07 + lat * 0.04);
          baseCol = mix(baseCol, snowCol, snowMix);
        }

        // Ice Age frost glaze across terrain
        float frostNoise = noise3(vLocalDir * 14.0 + vec3(2.1));
        float iceMask = smoothstep(1.0 - uIce * 1.15, 1.15 - uIce * 0.95, lat + frostNoise * 0.38);
        baseCol = mix(baseCol, vec3(0.84, 0.94, 1.0), iceMask * uIce * 0.88);

        // Scorched basalt crater rim
        baseCol = mix(baseCol, vec3(0.14, 0.11, 0.13), clamp(vCraterRim * 1.1, 0.0, 0.92));

        // Lighting: rich tactile diorama key sun + cool observatory fill + golden terminator
        float NdotL = dot(N, L);
        float dayTerm = smoothstep(-0.22, 0.34, NdotL);
        float goldenTerm = exp(-pow(NdotL * 4.2, 2.0)) * (1.0 - uNight * 0.55);

        vec3 sunColor = mix(vec3(0.92, 0.84, 0.72), vec3(1.15, 0.62, 0.28), goldenTerm);
        vec3 ambientDay = vec3(0.16, 0.22, 0.30);
        vec3 ambientNight = vec3(0.04, 0.07, 0.14);
        vec3 ambient = mix(ambientDay, ambientNight, uNight * 0.82);

        // Bounce fill from warm observatory brass
        float rimBounce = pow(1.0 - max(dot(N, V), 0.0), 2.6);
        vec3 bounceCol = vec3(0.18, 0.16, 0.28) * rimBounce * 0.45;

        vec3 lit = baseCol * (ambient + sunColor * dayTerm * 0.84) + bounceCol;
        lit += vec3(0.95, 0.48, 0.18) * goldenTerm * 0.12 * dayTerm;

        // Night-side bioluminescent spring glow & glowing alpine crystals
        float nightMask = smoothstep(0.18, -0.22, NdotL) * 0.72 + uNight * 0.68;
        float bioVeins = smoothstep(0.64, 0.85, noise3(vLocalDir * 18.0 + vec3(uTime * 0.08)));
        float bioRegion = smoothstep(0.012, 0.055, h) * (1.0 - smoothstep(0.08, 0.12, h));
        vec3 bioCol = mix(vec3(0.12, 0.95, 0.74), vec3(0.32, 0.82, 1.0), micro);
        lit += bioCol * bioVeins * bioRegion * nightMask * (0.42 + uSpring * 1.15);

        // Molten glowing lava crater core & cracks (HDR > 1.15 triggers crisp Bloom)
        if (vCraterHeat > 0.01) {
          float crack = noise3(vLocalDir * 40.0 + vec3(uTime * 0.4));
          float magma = smoothstep(0.22, 0.72, crack) * 0.72 + 0.55;
          vec3 lavaCol = mix(vec3(1.5, 0.26, 0.03), vec3(2.8, 1.35, 0.24), clamp(vCraterHeat * magma, 0.0, 1.0));
          lit = mix(lit, lavaCol, smoothstep(0.04, 0.45, vCraterHeat));
        }

        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });
}

export function createOceanMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.7, 0.55, 0.45).normalize() },
      uIce: { value: 0.0 },
      uNight: { value: 0.0 },
      uSpring: { value: 0.25 },
      uCraters: {
        value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 1, 0, 0)),
      },
      uCraterAges: { value: [0, 0, 0, 0, 0, 0] },
    },
    vertexShader: /* glsl */ `
      attribute float aLandElev;

      uniform float uTime;
      uniform float uIce;
      uniform vec4 uCraters[6];
      uniform float uCraterAges[6];

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalDir;
      varying float vDepth;
      varying float vTsunami;

      void main() {
        vec3 dir = normalize(position);
        float wave = sin(dir.x * 16.0 + uTime * 2.1) * cos(dir.z * 16.0 - uTime * 1.6) * 0.0022;
        wave *= (1.0 - uIce * 0.85);

        float tsunamiAmp = 0.0;
        float tsunamiRing = 0.0;

        for (int i = 0; i < 6; i++) {
          float cInt = uCraters[i].w;
          float age = uCraterAges[i];
          if (cInt > 0.01 && age < 9.0) {
            float d = acos(clamp(dot(dir, normalize(uCraters[i].xyz)), -1.0, 1.0));
            float front = 0.14 + age * 0.36;
            float ringDist = abs(d - front);
            float fade = exp(-age * 0.34);
            float crest = exp(-pow(ringDist * 16.0, 2.0)) * fade;
            // Secondary trailing wave
            float crest2 = exp(-pow((ringDist - 0.09) * 18.0, 2.0)) * fade * 0.55;
            tsunamiAmp += (crest + crest2) * 0.026;
            tsunamiRing = max(tsunamiRing, crest + crest2 * 0.7);
          }
        }

        vec3 displaced = dir * (1.0 + wave + tsunamiAmp);
        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);

        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * dir);
        vLocalDir = dir;
        vDepth = 1.0 - aLandElev;
        vTsunami = clamp(tsunamiRing, 0.0, 1.0);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uIce;
      uniform float uNight;
      uniform float uSpring;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vLocalDir;
      varying float vDepth;
      varying float vTsunami;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
              mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
              mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Subtle animated ripple normal perturbation
        float r1 = noise3(vLocalDir * 28.0 + vec3(uTime * 0.45, -uTime * 0.32, 0.0));
        float r2 = noise3(vLocalDir * 44.0 - vec3(0.0, uTime * 0.55, uTime * 0.35));
        vec3 waveN = normalize(N + vec3(r1 - 0.5, r2 - 0.5, r1 - r2) * 0.14 * (1.0 - uIce * 0.85));

        float shallow = 1.0 - smoothstep(0.0, 0.048, vDepth);
        float foamBand = smoothstep(0.015, 0.001, vDepth) * (0.65 + 0.35 * sin(vDepth * 420.0 - uTime * 3.8));

        vec3 deepTeal = mix(vec3(0.03, 0.26, 0.38), vec3(0.02, 0.10, 0.22), uNight * 0.75);
        vec3 turquoise = mix(vec3(0.08, 0.60, 0.62), vec3(0.12, 0.72, 0.68), uSpring * 0.45);
        vec3 waterCol = mix(deepTeal, turquoise, shallow * 0.92);

        // Faceted Ice Shelf freeze during Polar Ice Age
        float lat = abs(vLocalDir.y);
        float iceNoise = noise3(vLocalDir * 12.0);
        float iceCrack = abs(noise3(vLocalDir * 24.0) - 0.5);
        float iceFront = mix(-0.15, 1.35, uIce);
        float frozenMask = smoothstep(1.0 - iceFront, 1.25 - iceFront, lat + iceNoise * 0.48) * smoothstep(0.01, 0.18, uIce);

        vec3 iceCol = mix(vec3(0.66, 0.84, 0.96), vec3(0.36, 0.66, 0.88), smoothstep(0.0, 0.16, iceCrack));
        waterCol = mix(waterCol, iceCol, frozenMask * 0.92);

        // Lighting
        float NdotL = max(dot(waveN, L), 0.0);
        float dayTerm = smoothstep(-0.18, 0.35, dot(N, L));
        vec3 H = normalize(L + V);
        float specPower = mix(96.0, 32.0, frozenMask);
        float spec = pow(max(dot(waveN, H), 0.0), specPower) * mix(0.68, 0.32, frozenMask);

        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.4);
        vec3 skyRefl = mix(vec3(0.22, 0.52, 0.72), vec3(0.10, 0.22, 0.42), uNight);

        vec3 col = waterCol * (mix(0.24, 0.12, uNight) + dayTerm * 0.78);
        col += vec3(1.0, 0.92, 0.76) * spec * (1.0 - uNight * 0.6);
        col = mix(col, skyRefl, fresnel * 0.42);

        // Coastal foam + glowing tsunami shockwave ring
        col = mix(col, vec3(0.92, 0.99, 1.0), clamp(foamBand * 0.85 * (1.0 - frozenMask * 0.7), 0.0, 0.92));
        vec3 tsunamiFoam = vec3(0.78, 0.98, 1.0) * 1.25;
        col = mix(col, tsunamiFoam, clamp(vTsunami * 1.15, 0.0, 0.95));

        // Subtle bioluminescent plankton shimmer on night coasts
        float bioPlankton = shallow * uNight * smoothstep(0.62, 0.88, r2) * (0.4 + uSpring * 0.8);
        col += vec3(0.14, 0.95, 0.86) * bioPlankton * 0.6;

        float alpha = mix(0.90, 0.97, frozenMask + shallow * 0.06);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export function createCrystalGlassMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.7, 0.55, 0.45).normalize() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewNormal;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uTime;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewNormal;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        // Ultra-crisp Fresnel glass rim — center stays ~98% transparent so inner diorama is razor-sharp!
        float fresnel = pow(1.0 - ndotv, 4.4);
        float outerRim = pow(1.0 - ndotv, 8.0);

        // Studio softbox catchlights (top-left & bottom-right) for luxury watch crystal feel
        vec3 keyLight1 = normalize(vec3(-0.55, 0.72, 0.52));
        vec3 keyLight2 = normalize(vec3(0.75, -0.35, 0.55));
        vec3 H1 = normalize(keyLight1 + V);
        vec3 H2 = normalize(keyLight2 + V);
        vec3 Hs = normalize(L + V);

        float glint1 = smoothstep(0.965, 0.996, dot(N, H1)) * 0.55;
        float glint2 = smoothstep(0.955, 0.992, dot(N, H2)) * 0.25;
        float sunGlint = pow(max(dot(N, Hs), 0.0), 160.0) * 0.75;

        // Subtle chromatic dispersion along extreme glass edge
        vec3 rimCol = mix(vec3(0.62, 0.88, 1.0), vec3(1.0, 0.89, 0.66), 0.5 + 0.5 * vViewNormal.x);
        vec3 col = rimCol * (fresnel * 0.52 + outerRim * 0.45);
        col += vec3(1.0, 0.98, 0.94) * (glint1 + glint2 + sunGlint);

        float alpha = clamp(fresnel * 0.34 + outerRim * 0.38 + glint1 * 0.45 + glint2 * 0.22 + sunGlint * 0.5, 0.0, 0.72);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export function createAuroraMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.2 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float theta = atan(pos.z, pos.x);
        float sway = sin(theta * 5.0 + uTime * 1.6 + uv.y * 2.2) * 0.045
                   + cos(theta * 9.0 - uTime * 1.1) * 0.022;
        pos.x += normalize(vec2(pos.x, pos.z)).x * sway * uv.y;
        pos.z += normalize(vec2(pos.x, pos.z)).y * sway * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;

      void main() {
        float curtain = 0.5 + 0.5 * sin(vUv.x * 38.0 + uTime * 2.3 + sin(vUv.x * 13.0 - uTime * 1.2) * 1.6);
        float rays = 0.55 + 0.45 * sin(vUv.x * 78.0 - uTime * 3.1);
        float vertFade = smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.18, vUv.y);

        vec3 emerald = vec3(0.14, 1.15, 0.76);
        vec3 violet = vec3(0.68, 0.32, 1.25);
        vec3 col = mix(emerald, violet, smoothstep(0.28, 0.92, vUv.y));

        float alpha = curtain * rays * vertFade * uIntensity;
        gl_FragColor = vec4(col * 1.2, clamp(alpha, 0.0, 0.88));
      }
    `,
  });
}

export function createSkyDomeMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      varying vec3 vDir;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        // Deep midnight observatory velvet backdrop with subtle warm amber-indigo radial glow
        float grad = smoothstep(-0.7, 0.85, vDir.y);
        vec3 lowCol = vec3(0.010, 0.014, 0.032);
        vec3 highCol = vec3(0.020, 0.032, 0.072);
        vec3 col = mix(lowCol, highCol, grad);

        // Subtle warm observatory nebula halo behind the astrolabe
        float halo = exp(-pow(length(vDir.xy) * 2.1, 2.0)) * (1.0 - uNight * 0.25);
        col += vec3(0.055, 0.038, 0.018) * halo;

        // Crisp pinpoint circular stars (multi-layer spherical cell centers)
        vec3 p1 = vDir * 72.0;
        vec3 i1 = floor(p1);
        vec3 f1 = fract(p1) - 0.5;
        float rnd1 = hash31(i1);
        if (rnd1 > 0.972) {
          vec3 starOff = vec3(hash31(i1 + 1.1), hash31(i1 + 2.3), hash31(i1 + 3.7)) - 0.5;
          float d = length(f1 - starOff * 0.45);
          float pt = smoothstep(0.16, 0.02, d);
          float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + rnd1 * 120.0);
          vec3 starCol = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.88, 0.66), fract(rnd1 * 37.0));
          col += starCol * pt * twinkle * (0.75 + uNight * 0.55);
        }

        // Faint fine astronomical astrolabe arc lines
        float ring1 = smoothstep(0.0028, 0.0, abs(vDir.y));
        float ring2 = smoothstep(0.0028, 0.0, abs(vDir.x * 0.85 - vDir.y * 0.52));
        col += vec3(0.22, 0.16, 0.08) * (ring1 + ring2) * 0.16;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
