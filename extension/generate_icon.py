import os
import sys
import subprocess

# 1. Self-install Pillow if not present
try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow library not found. Installing Pillow automatically...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageDraw
    except Exception as e:
        print(f"Failed to install Pillow: {e}")
        sys.exit(1)

def create_icon(size):
    # Create image with transparent background
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Coordinates for a rounded rectangle shield
    padding = max(1, size // 8)
    rect_coords = [padding, padding, size - padding, size - padding]
    
    # Shield styling colors: gradient indigo/brand purple
    # Inner circle or rounded rect
    draw.rounded_rectangle(
        rect_coords, 
        radius=size // 4, 
        fill=(79, 70, 229, 255),  # brand indigo (#4f46e5)
        outline=(99, 102, 241, 255),  # brand indigo light (#6366f1)
        width=max(1, size // 16)
    )
    
    # Draw a stylized white letter "T" in the center
    # Find center and size
    font_size = size // 2
    # Simple lines representing a Shield checkmark or letter T
    cx = size // 2
    cy = size // 2
    offset = size // 6
    
    # Draw horizontal bar of 'T'
    draw.line(
        [(cx - offset, cy - offset), (cx + offset, cy - offset)],
        fill=(255, 255, 255, 255),
        width=max(2, size // 8)
    )
    # Draw vertical stem of 'T'
    draw.line(
        [(cx, cy - offset), (cx, cy + offset)],
        fill=(255, 255, 255, 255),
        width=max(2, size // 8)
    )
    
    filename = f"icon{size}.png"
    img.save(filename, "PNG")
    print(f"Saved {filename}")

if __name__ == "__main__":
    # Change current working directory to the script's folder
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    for s in [16, 48, 128]:
        create_icon(s)
    print("All extension icons generated successfully!")
