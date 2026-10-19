import { applyPalette, GIFEncoder, IGIFEncoder, Palette, quantize } from 'gifenc';

interface IPendingFrame
{
    rgba: Uint8ClampedArray;
    delay: number;
}

/**
 * GIF writer focused on pixel art:
 * - uses an exact palette whenever the frame has <= 255 colors (avatars almost always do), so there is no dithering / color loss
 * - only falls back to quantization when a frame really has more colors
 * - a real transparent index (no "magic" background color)
 * - consecutive identical frames are merged into a single longer frame
 */
export class GifWriter
{
    private _width: number;
    private _height: number;
    private _alphaThreshold: number;
    private _frames: IPendingFrame[];

    constructor(width: number, height: number, alphaThreshold: number = 128)
    {
        this._width = width;
        this._height = height;
        this._alphaThreshold = alphaThreshold;
        this._frames = [];
    }

    public addFrame(rgba: Uint8ClampedArray, delay: number): void
    {
        const copy = new Uint8ClampedArray(rgba);

        // normalize alpha (GIF only supports 1 bit alpha)
        for(let i = 0; i < copy.length; i += 4)
        {
            if(copy[i + 3] >= this._alphaThreshold)
            {
                copy[i + 3] = 255;
            }
            else
            {
                copy[i] = copy[i + 1] = copy[i + 2] = copy[i + 3] = 0;
            }
        }

        const last = this._frames[this._frames.length - 1];

        if(last && GifWriter.isEqual(last.rgba, copy))
        {
            last.delay += delay;

            return;
        }

        this._frames.push({ rgba: copy, delay });
    }

    public get frameCount(): number
    {
        return this._frames.length;
    }

    public encode(): Buffer
    {
        const encoder: IGIFEncoder = GIFEncoder();

        // the animation is a loop: when the second half repeats the first one, drop it
        const frames = GifWriter.removeRepeatedCycle(this._frames);

        for(let i = 0; i < frames.length; i++)
        {
            const frame = frames[i];
            const [ index, palette ] = this.indexFrame(frame.rgba);

            encoder.writeFrame(index, this._width, this._height, {
                palette,
                delay: Math.max(20, frame.delay),
                transparent: true,
                transparentIndex: 0,
                repeat: 0
            });
        }

        encoder.finish();

        return Buffer.from(encoder.bytes());
    }

    private indexFrame(rgba: Uint8ClampedArray): [ Uint8Array, Palette ]
    {
        const pixelCount = (rgba.length / 4);
        const index = new Uint8Array(pixelCount);
        const colors = new Map<number, number>();
        const palette: Palette = [ [ 0, 0, 0 ] ];

        let exact = true;

        for(let i = 0; i < pixelCount; i++)
        {
            const o = (i * 4);

            if(!rgba[o + 3]) continue;

            const key = ((rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2]);

            let colorIndex = colors.get(key);

            if(colorIndex === undefined)
            {
                if(palette.length >= 256)
                {
                    exact = false;

                    break;
                }

                colorIndex = palette.length;

                colors.set(key, colorIndex);
                palette.push([ rgba[o], rgba[o + 1], rgba[o + 2] ]);
            }

            index[i] = colorIndex;
        }

        if(exact) return [ index, palette ];

        // too many colors: quantize only the visible pixels
        const opaque: number[] = [];

        for(let i = 0; i < pixelCount; i++)
        {
            const o = (i * 4);

            if(rgba[o + 3]) opaque.push(rgba[o], rgba[o + 1], rgba[o + 2], 255);
        }

        const quantized = quantize(new Uint8ClampedArray(opaque), 255, { format: 'rgb565' });
        const mapped = applyPalette(rgba, quantized, 'rgb565');

        for(let i = 0; i < pixelCount; i++) index[i] = (rgba[(i * 4) + 3] ? (mapped[i] + 1) : 0);

        return [ index, [ [ 0, 0, 0 ], ...quantized ] ];
    }

    private static removeRepeatedCycle(frames: IPendingFrame[]): IPendingFrame[]
    {
        while((frames.length >= 2) && !(frames.length % 2))
        {
            const half = (frames.length / 2);

            for(let i = 0; i < half; i++)
            {
                if((frames[i].delay !== frames[i + half].delay) || !GifWriter.isEqual(frames[i].rgba, frames[i + half].rgba)) return frames;
            }

            frames = frames.slice(0, half);
        }

        return frames;
    }

    private static isEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean
    {
        if(a.length !== b.length) return false;

        for(let i = 0; i < a.length; i++)
        {
            if(a[i] !== b[i]) return false;
        }

        return true;
    }
}
