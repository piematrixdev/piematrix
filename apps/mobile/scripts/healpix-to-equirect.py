#!/usr/bin/env python3
"""
Convert Stellarium HiPS order-0 milkyway tiles to equirectangular.

Uses the EXACT same projection as Stellarium's healpix.c:
- healpix_xy2vec: HEALPix XY → 3D vector
- healpix_get_mat3: tile UV → HEALPix XY (per face)

We invert this: 3D vector → HEALPix XY → find face → invert mat3 → tile UV.
"""

import numpy as np
from PIL import Image
import os
import math

TILE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    '..', '..', '..',
    'stellarium-web-engine-master/apps/test-skydata/surveys/milkyway/Norder0/Dir0')
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'milkyway-equirect.png')

OUT_W = 1024
OUT_H = 512
TILE_SIZE = 512

# Face positions from Stellarium's healpix.c
FACES = [
    (1, 0), (3, 0), (5, 0), (7, 0),    # North polar: faces 0-3
    (0, -1), (2, -1), (4, -1), (6, -1), # Equatorial: faces 4-7
    (1, -2), (3, -2), (5, -2), (7, -2), # South polar: faces 8-11
]


def vec2healpix_xy(x, y, z):
    """
    Convert 3D unit vector to HEALPix XY projection coordinates.
    Inverse of healpix_xy2vec from Stellarium.
    
    In HEALPix projection:
    - Equatorial region (|z| <= 2/3): x_hp = phi, y_hp = 3*pi/8 * z
    - Polar region (|z| > 2/3): x_hp and y_hp follow the polar formula
    
    Returns (hx, hy) in HEALPix XY space.
    """
    phi = math.atan2(y, x)  # [-pi, pi]
    za = abs(z)
    
    if za <= 2.0/3.0:
        # Equatorial region
        # phi must be in [0, 2*pi] to match FACES coordinate system
        phi_pos = phi if phi >= 0 else phi + 2*math.pi
        hx = phi_pos
        hy = z * 3 * math.pi / 8
    else:
        # Polar region
        phi_pos = phi if phi >= 0 else phi + 2*math.pi  # [0, 2pi]
        sigma = math.sqrt(3 * (1 - za))  # 0 at pole, 1 at boundary
        # Find the face center longitude in [0, 2pi]
        face_idx = int(phi_pos / (math.pi/2))  # 0-3
        face_idx = min(face_idx, 3)
        xc = (face_idx + 0.5) * math.pi / 2  # face center in [0, 2pi]
        
        if sigma > 1e-10:
            hx = xc + (phi_pos - xc) * sigma
        else:
            hx = phi_pos
        
        hy = (math.pi/4) * (2 - sigma) * (1 if z > 0 else -1)
    
    return hx, hy


def healpix_xy_to_face_uv(hx, hy):
    """
    Given HEALPix XY coordinates, find which face (0-11) they belong to
    and return the UV coordinates [0,1]² within that face's tile.
    
    Uses the inverse of healpix_get_mat3:
    mat3 maps [u, v, 1] → [hx, hy, 1] (homogeneous)
    So [u, v] = mat3_inv * [hx, hy, 1] (take first 2 components)
    """
    nside = 1
    scale = math.pi / 4  # pi/4 per nside unit
    
    best_face = -1
    best_u = 0
    best_v = 0
    best_dist = 1e10
    
    for face in range(12):
        fx, fy = FACES[face]
        # From healpix_get_mat3:
        # mat[0] = [+pi/4/nside, +pi/4/nside, 0]
        # mat[1] = [-pi/4/nside, +pi/4/nside, 0]  
        # mat[2] = [(fx + (ix-iy)/nside)*pi/4, (fy + (ix+iy)/nside)*pi/4, 1]
        # For nside=1, ix=0, iy=0:
        # mat[2] = [fx*pi/4, fy*pi/4, 1]
        #
        # The mapping is: [hx, hy, 1] = u*mat[0] + v*mat[1] + 1*mat[2]
        # hx = u*(pi/4) + v*(-pi/4) + fx*(pi/4)
        # hy = u*(pi/4) + v*(pi/4) + fy*(pi/4)
        #
        # Solving for u, v:
        # hx/(pi/4) = u - v + fx  →  u - v = hx/(pi/4) - fx
        # hy/(pi/4) = u + v + fy  →  u + v = hy/(pi/4) - fy
        #
        # u = ((hx/(pi/4) - fx) + (hy/(pi/4) - fy)) / 2
        # v = ((hy/(pi/4) - fy) - (hx/(pi/4) - fx)) / 2
        
        hx_s = hx / scale  # normalized
        hy_s = hy / scale
        
        u = ((hx_s - fx) + (hy_s - fy)) / 2
        v = ((hy_s - fy) - (hx_s - fx)) / 2
        
        # Check if (u, v) is within [0, 1]
        if -0.01 <= u <= 1.01 and -0.01 <= v <= 1.01:
            # Clamp
            u_c = max(0, min(1 - 1e-6, u))
            v_c = max(0, min(1 - 1e-6, v))
            # Distance from center (prefer faces where we're well inside)
            dist = max(abs(u - 0.5), abs(v - 0.5))
            if dist < best_dist:
                best_dist = dist
                best_face = face
                best_u = u_c
                best_v = v_c
    
    return best_face, best_u, best_v


def main():
    # Load all 12 tiles
    tiles = {}
    for i in range(12):
        path = os.path.join(TILE_DIR, f'Npix{i}.webp')
        if os.path.exists(path):
            tiles[i] = np.array(Image.open(path).convert('RGB')).astype(np.float32)
        else:
            tiles[i] = np.zeros((TILE_SIZE, TILE_SIZE, 3), dtype=np.float32)
    print("  Loaded 12 tiles")
    
    print(f"  Generating {OUT_W}x{OUT_H} equirectangular...")
    out = np.zeros((OUT_H, OUT_W, 3), dtype=np.uint8)
    
    for py in range(OUT_H):
        if py % 50 == 0:
            print(f"    row {py}/{OUT_H}...")
        theta = (py + 0.5) * math.pi / OUT_H  # colatitude
        z = math.cos(theta)
        sin_theta = math.sin(theta)
        
        for px in range(OUT_W):
            phi = (px + 0.5) * 2 * math.pi / OUT_W  # [0, 2pi] = RA
            
            # 3D vector (equatorial: x toward RA=0, y toward RA=90°, z toward NCP)
            x = sin_theta * math.cos(phi)
            y = sin_theta * math.sin(phi)
            
            # Convert to HEALPix XY (phi in [0, 2pi])
            hx, hy = vec2healpix_xy(x, y, z)
            
            # Find face and UV
            face, u, v = healpix_xy_to_face_uv(hx, hy)
            
            if face < 0:
                continue
            
            # Sample tile with bilinear interpolation
            tile = tiles[face]
            # UV to pixel: u → column, v → row (no flip needed — verified)
            tx = u * (TILE_SIZE - 1)
            ty = v * (TILE_SIZE - 1)
            
            x0 = int(tx)
            y0 = int(ty)
            x1 = min(x0 + 1, TILE_SIZE - 1)
            y1 = min(y0 + 1, TILE_SIZE - 1)
            xf = tx - x0
            yf = ty - y0
            
            c = (tile[y0, x0] * (1-xf)*(1-yf) + tile[y0, x1] * xf*(1-yf) +
                 tile[y1, x0] * (1-xf)*yf + tile[y1, x1] * xf*yf)
            
            out[py, px] = np.clip(c, 0, 255).astype(np.uint8)
    
    # Convert to RGBA for expo compatibility
    img_rgb = Image.fromarray(out)
    img_rgba = img_rgb.convert('RGBA')
    
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    img_rgba.save(OUTPUT, optimize=True)
    fsize = os.path.getsize(OUTPUT) // 1024
    print(f"  Saved: {OUTPUT} ({fsize} KB)")
    
    # Verify galactic center (RA=266.4°, Dec=-28.9°)
    # theta=118.9°, phi in our output = RA = 266.4° → px = 266.4/360*OUT_W
    gc_x = int(266.4 / 360 * OUT_W)
    gc_y = int(118.9 / 180 * OUT_H)
    print(f"  Galactic center ({gc_x},{gc_y}): RGB = {out[gc_y, gc_x]}")


if __name__ == '__main__':
    print("Converting HiPS milkyway to equirectangular (Stellarium projection)...")
    main()
    print("Done!")
