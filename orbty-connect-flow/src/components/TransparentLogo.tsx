import { useEffect, useRef, useState } from "react";

interface TransparentLogoProps {
  src: string;
  alt: string;
  className?: string;
  threshold?: number;
}

/**
 * Loads an image, removes dark/black background pixels by setting their alpha to 0,
 * and renders the result as a truly transparent PNG via canvas.
 */
const TransparentLogo = ({
  src,
  alt,
  className = "",
  threshold = 60,
}: TransparentLogoProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate brightness - dark pixels are background
        const brightness = (r + g + b) / 3;

        if (brightness < threshold) {
          // Fully transparent for dark pixels
          data[i + 3] = 0;
        } else if (brightness < threshold + 40) {
          // Gradual fade for edge pixels (anti-aliasing)
          const fade = (brightness - threshold) / 40;
          data[i + 3] = Math.round(255 * fade);
        }
        // Bright pixels keep full opacity
      }

      ctx.putImageData(imageData, 0, 0);
      setLoaded(true);
    };
    img.src = src;
  }, [src, threshold]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      role="img"
      className={className}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
    />
  );
};

export default TransparentLogo;
