from PIL import Image, ImageDraw, ImageFont
import os


def create_wallet_icon(size):
    # Create a new image with a dark theme
    img = Image.new("RGBA", (size, size), (26, 26, 26, 255))
    draw = ImageDraw.Draw(img)

    # Draw background circle
    margin = size // 10
    radius = size // 2 - margin
    center = size // 2
    draw.ellipse(
        [(margin, margin), (size - margin, size - margin)],
        fill=(30, 30, 30, 255),
        outline=(58, 58, 58, 255),
        width=size // 20,
    )

    # Draw main symbol - a wallet/stablecoin-like shape
    symbol_size = int(radius * 0.6)
    symbol_x = center - symbol_size // 2
    symbol_y = center - symbol_size // 2

    # Draw rounded rectangle to represent wallet/purse
    draw.rounded_rectangle(
        [symbol_x, symbol_y, symbol_x + symbol_size, symbol_y + int(symbol_size * 0.7)],
        radius=symbol_size // 5,
        fill=(0, 122, 204, 255),  # Blue color
    )

    # Draw a coin-like circle
    coin_size = int(symbol_size * 0.4)
    coin_x = symbol_x + symbol_size - coin_size - size // 20
    coin_y = symbol_y + int(symbol_size * 0.7) // 2 - coin_size // 2
    draw.ellipse(
        [coin_x, coin_y, coin_x + coin_size, coin_y + coin_size],
        fill=(0, 204, 106, 255),  # Green color
    )

    # Add subtle highlight for depth
    highlight_pos = (center - radius + size // 15, center - radius + size // 15)
    highlight_size = int(radius * 0.3)
    draw.ellipse(
        [
            highlight_pos[0],
            highlight_pos[1],
            highlight_pos[0] + highlight_size,
            highlight_pos[1] + highlight_size,
        ],
        fill=(255, 255, 255, 64),
    )

    return img


def main():
    # Create the icons directory if it doesn't exist
    os.makedirs("icons", exist_ok=True)

    # Create icons in different sizes
    sizes = [16, 32, 48, 128]

    for size in sizes:
        img = create_wallet_icon(size)
        img.save(f"icons/icon{size}.png")
        print(f"Created icon{size}.png")

    print("All icons created successfully!")


if __name__ == "__main__":
    main()
