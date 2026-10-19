import { Canvas, createCanvas } from 'canvas';
import { Texture } from './Texture';

export class CanvasUtilities
{
    public static cropTransparentPixels(canvas: Canvas): Canvas
    {
        const bounds = {
            top: null,
            left: null,
            right: null,
            bottom: null
        };

        const ctx = canvas.getContext('2d');
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const length = pixels.data.length;
        
        for(let i = 0; i < length; i += 4)
        {
            if(pixels.data[i+3] !== 0)
            {
                const x = (i / 4) % canvas.width;
                const y = ~~((i / 4) / canvas.width);
      
                if(bounds.top === null) bounds.top = y;
                
                if(bounds.left === null) bounds.left = x; 
                else if (x < bounds.left) bounds.left = x;
          
                if(bounds.right === null) bounds.right = x; 
                else if(bounds.right < x) bounds.right = x;
          
                if(bounds.bottom === null) bounds.bottom = y;
                else if (bounds.bottom < y) bounds.bottom = y;
            }
        }
        
        const trimHeight = (bounds.bottom - bounds.top);
        const trimWidth = (bounds.right - bounds.left);
        const trimmed = ctx.getImageData(bounds.left, bounds.top, trimWidth, trimHeight);
      
        canvas.width = trimWidth;
        canvas.height = trimHeight;
        ctx.putImageData(trimmed, 0, 0);

        return canvas;
    }

    public static tintWithMultiply(texture: Texture, color: number): Canvas
    {
        const crop = texture.frame.clone();
        const resolution = texture.baseTexture.resolution;

        const canvas = createCanvas(Math.ceil(crop.width), Math.ceil(crop.height));
        const ctx = canvas.getContext('2d');

        crop.x *= resolution;
        crop.y *= resolution;
        crop.width *= resolution;
        crop.height *= resolution;

        ctx.save();
        ctx.fillStyle = `#${(`00000${(color | 0).toString(16)}`).substr(-6)}`;

        ctx.fillRect(0, 0, crop.width, crop.height);

        ctx.globalCompositeOperation = 'multiply';

        const source = texture.baseTexture.getDrawableSource();

        ctx.drawImage(
            source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height
        );

        ctx.globalCompositeOperation = 'destination-atop';

        ctx.drawImage(
            source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height
        );

        ctx.restore();

        return canvas;
    }

    public static scaleCanvas(canvas: Canvas, scaleX: number, scaleY: number): Canvas
    {
        const tempCanvas = this.createNitroCanvas((canvas.width * scaleX), (canvas.height * scaleY));
        const ctx = tempCanvas.getContext('2d');

        ctx.scale(scaleX, scaleY);
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

        return tempCanvas;
    }

    public static createNitroCanvas(width: number, height: number): Canvas
    {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = false;

        return canvas;
    }

    /**
     * Integer upscale with nearest neighbor (keeps the pixel art sharp).
     */
    public static scaleNearest(canvas: Canvas, factor: number): Canvas
    {
        factor = Math.max(1, Math.round(factor));

        if(factor === 1) return canvas;

        const source = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const target = this.createNitroCanvas((canvas.width * factor), (canvas.height * factor));
        const ctx = target.getContext('2d');
        const output = ctx.createImageData(target.width, target.height);
        const src = source.data;
        const dst = output.data;

        for(let y = 0; y < target.height; y++)
        {
            const sy = Math.floor(y / factor);

            for(let x = 0; x < target.width; x++)
            {
                const s = (((sy * canvas.width) + Math.floor(x / factor)) * 4);
                const d = (((y * target.width) + x) * 4);

                dst[d] = src[s];
                dst[d + 1] = src[s + 1];
                dst[d + 2] = src[s + 2];
                dst[d + 3] = src[s + 3];
            }
        }

        ctx.putImageData(output, 0, 0);

        return target;
    }

    /**
     * Downscale by 2 averaging each 2x2 block (premultiplied alpha), instead of dropping every other pixel.
     */
    public static downscaleHalf(canvas: Canvas): Canvas
    {
        const width = Math.max(1, Math.floor(canvas.width / 2));
        const height = Math.max(1, Math.floor(canvas.height / 2));
        const source = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const target = this.createNitroCanvas(width, height);
        const ctx = target.getContext('2d');
        const output = ctx.createImageData(width, height);
        const src = source.data;
        const dst = output.data;

        for(let y = 0; y < height; y++)
        {
            for(let x = 0; x < width; x++)
            {
                let r = 0, g = 0, b = 0, a = 0;

                for(let dy = 0; dy < 2; dy++)
                {
                    for(let dx = 0; dx < 2; dx++)
                    {
                        const sx = Math.min(canvas.width - 1, ((x * 2) + dx));
                        const sy = Math.min(canvas.height - 1, ((y * 2) + dy));
                        const o = (((sy * canvas.width) + sx) * 4);
                        const alpha = src[o + 3];

                        r += (src[o] * alpha);
                        g += (src[o + 1] * alpha);
                        b += (src[o + 2] * alpha);
                        a += alpha;
                    }
                }

                const d = (((y * width) + x) * 4);

                if(a)
                {
                    dst[d] = Math.round(r / a);
                    dst[d + 1] = Math.round(g / a);
                    dst[d + 2] = Math.round(b / a);
                    dst[d + 3] = Math.round(a / 4);
                }
            }
        }

        ctx.putImageData(output, 0, 0);

        return target;
    }
}
