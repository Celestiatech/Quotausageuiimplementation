import os
from PIL import Image, ImageOps

os.makedirs('public/store-screenshots', exist_ok=True)
os.makedirs('store-screenshots', exist_ok=True)

sources = [
    ('1-value-dashboard', 'public/marketing/value-dashboard.png'),
    ('2-howitworks-install', 'public/marketing/howitworks-install.png'),
    ('3-howitworks-match', 'public/marketing/howitworks-match.png'),
    ('4-howitworks-track', 'public/marketing/howitworks-track.png'),
    ('5-reliability-evidence', 'public/marketing/reliability-evidence.png'),
]

print("Generating 1280x800 Chrome Web Store screenshots (JPEG & 24-bit PNG, no alpha)...")

for name, src in sources:
    img = Image.open(src)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Fit exactly to 1280x800
    resized = ImageOps.fit(img, (1280, 800), method=Image.Resampling.LANCZOS)
    
    # Save 24-bit PNG (RGB, no alpha) and JPEG to both folders
    for out_dir in ['public/store-screenshots', 'store-screenshots']:
        png_path = os.path.join(out_dir, f'{name}.png')
        resized.save(png_path, format='PNG')
        
        jpg_path = os.path.join(out_dir, f'{name}.jpg')
        resized.save(jpg_path, format='JPEG', quality=95)
        
    print(f"  [OK] {name} -> 1280x800 (PNG 24-bit + JPEG, 0 alpha)")

print("\nDone! Screenshots ready in public/store-screenshots/ and store-screenshots/.")
