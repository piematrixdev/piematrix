#!/usr/bin/env python3
"""
Convert a Milky Way panorama from galactic coordinates to equatorial coordinates.

Input: equirectangular image in galactic frame (MW band horizontal at center)
Output: equirectangular image in equatorial frame (MW band diagonal ~63° tilt)

Uses the standard IAU galactic-to-equatorial rotation matrix.
"""

import numpy as np
from PIL import Image
import os

INPUT = '/Volumes/BetterSpace/SkyGuild/The-Sky-Circle/SkyWatch/apps/mobile/assets/milkyway-galactic.png'
OUTPUT = '/Volumes/BetterSpace/SkyGuild/The-Sky-Circle/SkyWatch/apps/mobile/assets/milkyway.png'

# Output size (match input aspect 2:1)
OUT_W = 2048
OUT_H = 1024

# Galactic-to-equatorial rotation matrix (IAU 1958 + J2000 precession)
# This rotates a unit vector from galactic (l,b) frame to equatorial (RA,Dec) frame.
# Galactic north pole: RA=192.8595°, Dec=27.1284°
# Galactic center: RA=266.405°, Dec=-28.936°
# Ascending node of galactic plane on equator: l=33°

# The matrix columns are the equatorial unit vectors of the galactic axes:
# Col 0 = galactic center direction (l=0, b=0) in equatorial
# Col 1 = l=90°, b=0° direction in equatorial  
# Col 2 = galactic north pole (b=90°) in equatorial
GAL_TO_EQ = np.array([
    [-0.0549,  0.4941, -0.8677],
    [-0.8734, -0.4448, -0.1981],
    [-0.4839,  0.7470,  0.4560],
])

# Inverse (equatorial to galactic) = transpose since it's orthogonal
EQ_TO_GAL = GAL_TO_EQ.T


def main():
    img = Image.open(INPUT).convert('RGB')
    src = np.array(img).astype(np.float32)
    in_h, in_w = src.shape[:2]
    print(f"  Input: {in_w}x{in_h}")

    out = np.zeros((OUT_H, OUT_W, 3), dtype=np.uint8)

    print(f"  Converting galactic → equatorial ({OUT_W}x{OUT_H})...")

    # For each output pixel (equatorial frame), find the corresponding
    # galactic coordinates and sample the input image.
    for py in range(OUT_H):
        # Equatorial: Dec from +90° (top) to -90° (bottom)
        dec = (0.5 - (py + 0.5) / OUT_H) * np.pi  # [+pi/2, -pi/2]
        cos_dec = np.cos(dec)
        sin_dec = np.sin(dec)

        for px in range(OUT_W):
            # Equatorial: RA from 0° (left) to 360° (right)
            ra = (px + 0.5) / OUT_W * 2 * np.pi  # [0, 2*pi]

            # Unit vector in equatorial frame
            eq_vec = np.array([
                cos_dec * np.cos(ra),
                cos_dec * np.sin(ra),
                sin_dec,
            ])

            # Rotate to galactic frame
            gal_vec = EQ_TO_GAL @ eq_vec

            # Extract galactic (l, b) from the galactic unit vector
            gal_b = np.arcsin(np.clip(gal_vec[2], -1, 1))  # [-pi/2, pi/2]
            gal_l = np.arctan2(gal_vec[1], gal_vec[0])      # [-pi, pi]

            # Map to input image pixel coordinates
            # Input is galactic equirectangular: l=0 at center, l increases left
            # Standard: left edge = l=180° (or -180°), center = l=0°, right = l=-180°
            # Actually ESO panorama: center = galactic center (l=0), 
            # left edge = l=180°, right edge = l=-180° (l increases to the left)
            # So: u = 0.5 - l/(2*pi)... let me check:
            # At l=0 (center): u = 0.5 → px = in_w/2 ✓
            # At l=+pi (left): u = 0.0 → px = 0 ✓
            # At l=-pi (right): u = 1.0 → px = in_w ✓
            u = 0.5 - gal_l / (2 * np.pi)
            # b: top = +90° (b=pi/2), bottom = -90° (b=-pi/2)
            v = 0.5 - gal_b / np.pi

            # Wrap u to [0, 1)
            u = u % 1.0
            v = np.clip(v, 0, 0.9999)

            # Bilinear sample from input
            sx = u * (in_w - 1)
            sy = v * (in_h - 1)
            x0 = int(sx)
            y0 = int(sy)
            x1 = min(x0 + 1, in_w - 1)
            y1 = min(y0 + 1, in_h - 1)
            xf = sx - x0
            yf = sy - y0

            c = (src[y0, x0] * (1-xf)*(1-yf) + src[y0, x1] * xf*(1-yf) +
                 src[y1, x0] * (1-xf)*yf + src[y1, x1] * xf*yf)
            out[py, px] = np.clip(c, 0, 255).astype(np.uint8)

    # Save as RGBA for expo compatibility
    img_out = Image.fromarray(out).convert('RGBA')
    img_out.save(OUTPUT, optimize=True)
    fsize = os.path.getsize(OUTPUT) // 1024
    print(f"  Saved: {OUTPUT} ({fsize} KB)")


if __name__ == '__main__':
    print("Converting Milky Way from galactic to equatorial frame...")
    main()
    print("Done!")
