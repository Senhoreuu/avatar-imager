import { Canvas, createCanvas } from 'canvas';
import { BaseTexture } from './BaseTexture';
import { CanvasUtilities } from './CanvasUtilities';
import { Rectangle } from './Rectangle';

export class Texture
{
    private _baseTexture: BaseTexture;
    private _frame: Rectangle;
    private _orig: Rectangle;
    private _trim: Rectangle;
    private _drawableCanvas: Canvas;

    constructor(baseTexture: BaseTexture, frame: Rectangle, orig: Rectangle, trim: Rectangle)
    {
        this._baseTexture = baseTexture;
        this._frame = frame;
        this._orig = orig;
        this._trim = trim;

        this.buildTexture();
    }

    private buildTexture(): void
    {
        const width = this._frame.width;
        const height = this._frame.height;

        let dx = 0;
        let dy = 0;

        if(this._trim)
        {
            dx = (this._trim.width / 2) + this._trim.x - (0 * this._orig.width);
            dy = (this._trim.height / 2) + this._trim.y - (0 * this._orig.height);
        }
        else
        {
            dx = (0.5 - 0) * this._orig.width;
            dy = (0.5 - 0) * this._orig.height;
        }

        dx -= width / 2;
        dy -= height / 2;

        const canvas = createCanvas(this._orig.width, this._orig.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            this._baseTexture.image,
            this._frame.x * this._baseTexture.resolution,
            this._frame.y * this._baseTexture.resolution,
            Math.floor(width * this._baseTexture.resolution),
            Math.floor(height * this._baseTexture.resolution),
            Math.floor(dx * this._baseTexture.resolution),
            Math.floor(dy * this._baseTexture.resolution),
            Math.floor(width * this._baseTexture.resolution),
            Math.floor(height * this._baseTexture.resolution)
        );

        this._drawableCanvas = canvas;
    }

    private _tintCache: Map<number, Canvas> = null;
    private _halfScaled: Texture = null;

    public static fromCanvas(canvas: Canvas): Texture
    {
        const texture = Object.create(Texture.prototype) as Texture;
        const rect = new Rectangle(0, 0, canvas.width, canvas.height);

        texture._baseTexture = null;
        texture._frame = rect;
        texture._orig = rect.clone();
        texture._trim = null;
        texture._drawableCanvas = canvas;
        texture._tintCache = null;
        texture._halfScaled = null;

        return texture;
    }

    // used when a library has no small (sh) assets
    public getHalfScaled(): Texture
    {
        if(!this._halfScaled) this._halfScaled = Texture.fromCanvas(CanvasUtilities.downscaleHalf(this._drawableCanvas));

        return this._halfScaled;
    }

    /**
     * Same math as a PixiJS sprite tint: rgb * tint, alpha untouched.
     */
    public getTintedWithMultiply(color: number): Canvas
    {
        color = ((color === undefined) || (color === null)) ? 0xFFFFFF : (color & 0xFFFFFF);

        if(color === 0xFFFFFF) return this._drawableCanvas;

        if(!this._tintCache) this._tintCache = new Map();

        const cached = this._tintCache.get(color);

        if(cached) return cached;

        const source = this._drawableCanvas;
        const canvas = createCanvas(source.width, source.height);
        const ctx = canvas.getContext('2d');

        if(source.width && source.height)
        {
            const imageData = source.getContext('2d').getImageData(0, 0, source.width, source.height);
            const pixels = imageData.data;
            const r = ((color >> 16) & 0xFF) / 255;
            const g = ((color >> 8) & 0xFF) / 255;
            const b = (color & 0xFF) / 255;

            for(let i = 0; i < pixels.length; i += 4)
            {
                if(!pixels[i + 3]) continue;

                pixels[i] = Math.round(pixels[i] * r);
                pixels[i + 1] = Math.round(pixels[i + 1] * g);
                pixels[i + 2] = Math.round(pixels[i + 2] * b);
            }

            ctx.putImageData(imageData, 0, 0);
        }

        if(this._tintCache.size >= 16) this._tintCache.delete(this._tintCache.keys().next().value);

        this._tintCache.set(color, canvas);

        return canvas;
    }

    public get baseTexture(): BaseTexture
    {
        return this._baseTexture;
    }

    public get frame(): Rectangle
    {
        return this._frame;
    }

    public get orig(): Rectangle
    {
        return this._orig;
    }

    public get trim(): Rectangle
    {
        return this._trim;
    }

    public get drawableCanvas(): Canvas
    {
        return this._drawableCanvas;
    }

    public get width(): number
    {
        return this.drawableCanvas.width;
    }

    public get height(): number
    {
        return this._drawableCanvas.height;
    }
}
