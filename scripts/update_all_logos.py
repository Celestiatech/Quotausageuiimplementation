import os
import shutil
from PIL import Image

src_candidates = [
    r'C:\Users\ADMIN\Downloads\raw-logo-Photoroom.png',
    r'e:\Autoapply\new_logo_transparent.png',
]

src_logo_path = None
for candidate in src_candidates:
    if os.path.exists(candidate):
        src_logo_path = candidate
        break

if not src_logo_path:
    print("Error: Source logo file not found in Downloads or workspace!")
    exit(1)

print(f"Using source logo from: {src_logo_path}")

# Copy to workspace root and public/logos
shutil.copyfile(src_logo_path, r'e:\Autoapply\new_logo_transparent.png')
os.makedirs('public/logos', exist_ok=True)
shutil.copyfile(src_logo_path, r'e:\Autoapply\public\logos\new_logo_transparent.png')

# Open and center with balanced padding
raw_img = Image.open(src_logo_path).convert('RGBA')
bbox = raw_img.getbbox()
if bbox:
    cropped = raw_img.crop(bbox)
    max_dim = max(cropped.width, cropped.height)
    canvas_size = int(max_dim * 1.12)  # 6% padding on each side
    square_canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = ((canvas_size - cropped.width) // 2, (canvas_size - cropped.height) // 2)
    square_canvas.paste(cropped, offset, cropped)
    base_img = square_canvas
else:
    base_img = raw_img

# Target mappings
targets = [
    # Root public assets
    ('public/favicon-16x16.png', (16, 16)),
    ('public/favicon-32x32.png', (32, 32)),
    ('public/favicon-48x48.png', (48, 48)),
    ('public/favicon-96x96.png', (96, 96)),
    ('public/apple-touch-icon.png', (180, 180)),
    ('public/android-chrome-192x192.png', (192, 192)),
    ('public/android-chrome-512x512.png', (512, 512)),
    
    # public/logos
    ('public/logos/brandmark-80.png', (80, 80)),
    ('public/logos/download.png', (80, 80)),
    ('public/logos/favicon-16x16.png', (16, 16)),
    ('public/logos/favicon-32x32.png', (32, 32)),
    ('public/logos/apple-touch-icon.png', (180, 180)),
    ('public/logos/android-chrome-192x192.png', (192, 192)),
    ('public/logos/android-chrome-512x512.png', (512, 512)),
    
    # CareerPilotLinkedInExtension
    ('CareerPilotLinkedInExtension/icons/icon16.png', (16, 16)),
    ('CareerPilotLinkedInExtension/icons/icon32.png', (32, 32)),
    ('CareerPilotLinkedInExtension/icons/icon48.png', (48, 48)),
    ('CareerPilotLinkedInExtension/icons/icon128.png', (128, 128)),
    
    # CareerPilotIndeedExtension
    ('CareerPilotIndeedExtension/icons/icon16.png', (16, 16)),
    ('CareerPilotIndeedExtension/icons/icon32.png', (32, 32)),
    ('CareerPilotIndeedExtension/icons/icon48.png', (48, 48)),
    ('CareerPilotIndeedExtension/icons/icon128.png', (128, 128)),
    
    # AutoApplyCvMeetCopilotLiveExtension
    ('AutoApplyCvMeetCopilotLiveExtension/icons/icon16.png', (16, 16)),
    ('AutoApplyCvMeetCopilotLiveExtension/icons/icon32.png', (32, 32)),
    ('AutoApplyCvMeetCopilotLiveExtension/icons/icon48.png', (48, 48)),
    ('AutoApplyCvMeetCopilotLiveExtension/icons/icon128.png', (128, 128)),
    
    # JobsSmartOutreachExtension
    ('JobsSmartOutreachExtension/icons/icon16.png', (16, 16)),
    ('JobsSmartOutreachExtension/icons/icon32.png', (32, 32)),
    ('JobsSmartOutreachExtension/icons/icon48.png', (48, 48)),
    ('JobsSmartOutreachExtension/icons/icon128.png', (128, 128)),
]

print("Updating all website and Chrome extension icons with user's PhotoRoom transparent logo...")

for rel_path, size in targets:
    out_dir = os.path.dirname(rel_path)
    os.makedirs(out_dir, exist_ok=True)
    
    # High-quality Lanczos downsampling
    resized = base_img.resize(size, Image.Resampling.LANCZOS)
    resized.save(rel_path, format='PNG')
    print(f"  [OK] Generated {rel_path} ({size[0]}x{size[1]})")

# Generate multi-size .ico files (contains 16, 32, 48)
ico_sizes = [(16, 16), (32, 32), (48, 48)]
base_img.save('public/favicon.ico', format='ICO', sizes=ico_sizes)
base_img.save('public/logos/favicon.ico', format='ICO', sizes=ico_sizes)
print("  [OK] Generated public/favicon.ico and public/logos/favicon.ico (multi-size ICO)")

print("\nSuccessfully updated all logos across the website and extension packages!")
