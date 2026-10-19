import { Canvas } from 'canvas';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { writeFile } from 'fs';
import { CanvasUtilities, File, FileUtilities, GifWriter } from '../../../../core';
import { Application } from '../../../Application';
import { AvatarScaleType, AvatarSetType, IAvatarImage, ISpriteDataContainer } from '../../../avatar';
import { BuildFigureOptionsRequest, BuildFigureOptionsStringRequest, IFigureBuildOptions, ProcessActionRequest, ProcessDanceRequest, ProcessDirectionRequest, ProcessEffectRequest, ProcessGestureRequest, RequestQuery } from './utils';

// bump this whenever the output changes, so old cached files are not served anymore
const RENDER_VERSION = 'hubbe-4';

// Nitro updates the avatar animation every 2 room frames (24fps) => ~12 frames per second
const GIF_FRAME_DELAY = (parseInt(process.env.AVATAR_GIF_FRAME_DELAY_MS) || 80);

const pendingRenders: Map<string, Promise<Buffer>> = new Map();

export const HabboImagingRouterGet = async (request: Request<any, any, any, RequestQuery>, response: Response) =>
{
    const query = request.query;

    try
    {
        const buildOptions = BuildFigureOptionsRequest(query);
        const contentType = ((buildOptions.imageFormat === 'gif') ? 'image/gif' : 'image/png');
        const directory = FileUtilities.getDirectory(process.env.AVATAR_SAVE_PATH as string);

        // the figure string can be huge (multiple items per type) and may contain characters that are not valid on a file name
        const cacheKey = createHash('sha1').update(RENDER_VERSION + '|' + BuildFigureOptionsStringRequest(buildOptions)).digest('hex');
        const saveFile = new File(`${ directory.path }/${ cacheKey }.${ buildOptions.imageFormat }`);

        if(saveFile.exists())
        {
            const buffer = await FileUtilities.readFileAsBuffer(saveFile.path);

            if(buffer)
            {
                SendImage(response, contentType, buffer);

                return;
            }
        }

        let pending = pendingRenders.get(cacheKey);

        if(!pending)
        {
            pending = RenderAvatar(query, buildOptions);

            pendingRenders.set(cacheKey, pending);

            pending
                .then(buffer => writeFile(saveFile.path, buffer, () => {}))
                .catch(() => {})
                .finally(() => pendingRenders.delete(cacheKey));
        }

        SendImage(response, contentType, await pending);
    }

    catch(err)
    {
        Application.instance.logger.error((err && err.stack) || err);

        if(!response.headersSent) response.writeHead(500).end();
    }
}

const SendImage = (response: Response, contentType: string, buffer: Buffer) =>
{
    response
        .writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400'
        })
        .end(buffer);
}

interface IRenderedFrames
{
    frames: Canvas[];
    missingScaleAssets: number;
}

const RenderAvatar = async (query: RequestQuery, buildOptions: IFigureBuildOptions): Promise<Buffer> =>
{
    if(buildOptions.effect > 0)
    {
        const effectManager = Application.instance.avatar.effectManager;

        if(!effectManager.isAvatarEffectReady(buildOptions.effect)) await effectManager.downloadAvatarEffect(buildOptions.effect);
    }

    const wantsSmall = (buildOptions.size < 1);

    let frames: Canvas[] = null;

    if(wantsSmall && !(buildOptions.effect > 0))
    {
        // the small size uses the real small assets (sh_* / hh_*_50_*) instead of shrinking the large ones.
        // parts without small assets (custom clothes) are downscaled individually inside the avatar cache
        frames = (await RenderFrames(query, buildOptions, AvatarScaleType.SMALL)).frames;
    }

    if(!frames)
    {
        frames = (await RenderFrames(query, buildOptions, AvatarScaleType.LARGE)).frames;

        if(wantsSmall) frames = frames.map(frame => CanvasUtilities.downscaleHalf(frame));
        else if(buildOptions.size > 1) frames = frames.map(frame => CanvasUtilities.scaleNearest(frame, buildOptions.size));
    }

    if(buildOptions.imageFormat !== 'gif') return frames[0].toBuffer('image/png');

    const writer = new GifWriter(frames[0].width, frames[0].height);

    for(const frame of frames)
    {
        writer.addFrame(frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data, GIF_FRAME_DELAY);
    }

    return writer.encode();
}

interface ISpriteDraw
{
    image: Canvas;
    x: number;
    y: number;
    z: number;
    flipH: boolean;
    additive: boolean;
}

interface IFrameLayout
{
    image: Canvas;
    x: number;
    y: number;
    back: ISpriteDraw[];
    front: ISpriteDraw[];
}

const RenderFrames = async (query: RequestQuery, buildOptions: IFigureBuildOptions, scaleType: string): Promise<IRenderedFrames> =>
{
    const avatar = await Application.instance.avatar.createAvatarImage(buildOptions.figure, scaleType, buildOptions.gender);

    if(!avatar) throw new Error('Unable to create the avatar image');

    ProcessDirectionRequest(query, avatar);

    avatar.initActionAppends();

    ProcessActionRequest(query, avatar);
    ProcessGestureRequest(query, avatar);
    ProcessDanceRequest(query, avatar);
    ProcessEffectRequest(query, avatar);

    await avatar.endActionAppends();

    // the client sets the direction after the actions: effects with a direction offset (and lay) depend on it
    const bodyDirection = avatar.getDirection();

    avatar.setDirection(AvatarSetType.FULL, bodyDirection);

    if(buildOptions.headDirection !== buildOptions.direction) avatar.setDirection(AvatarSetType.HEAD, buildOptions.headDirection);

    const isGif = (buildOptions.imageFormat === 'gif');
    const scale = ((scaleType === AvatarScaleType.LARGE) ? 64 : 32);

    let totalFrames = 1;

    if(isGif) totalFrames = Math.max(1, (avatar.getTotalFrameCount() * 2));
    else if(buildOptions.frameNumber > 0) avatar.updateAnimationByFrames(buildOptions.frameNumber);

    const layouts: IFrameLayout[] = [];

    for(let i = 0; i < totalFrames; i++)
    {
        if(i > 0) avatar.updateAnimationByFrames(1);

        const image = await avatar.getImage(buildOptions.setType, 0, false, 1);

        if(!image) throw new Error('Unable to render the avatar image');

        layouts.push(BuildFrameLayout(avatar, image, scale));
    }

    // output = the classic Habbo canvas (64x110 large / 45x72 small), expanded only when something
    // (pets, misc items, effects) really draws outside of it
    const base = GetBaseRect(layouts[0].image, scaleType);

    let minX = base.x;
    let minY = base.y;
    let maxX = (base.x + base.width);
    let maxY = (base.y + base.height);

    const include = (image: Canvas, x: number, y: number, flipH: boolean = false) =>
    {
        const bounds = GetOpaqueBounds(image);

        if(!bounds) return;

        const left = (flipH ? (x - bounds.x - bounds.width) : (x + bounds.x));

        minX = Math.min(minX, left);
        minY = Math.min(minY, (y + bounds.y));
        maxX = Math.max(maxX, (left + bounds.width));
        maxY = Math.max(maxY, (y + bounds.y + bounds.height));
    };

    for(const layout of layouts)
    {
        include(layout.image, layout.x, layout.y);

        for(const sprite of [ ...layout.back, ...layout.front ]) include(sprite.image, sprite.x, sprite.y, sprite.flipH);
    }

    minX = Math.floor(minX);
    minY = Math.floor(minY);

    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);
    const frames: Canvas[] = [];

    for(const layout of layouts)
    {
        const canvas = CanvasUtilities.createNitroCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const drawSprite = (sprite: ISpriteDraw) =>
        {
            ctx.save();

            if(sprite.additive) ctx.globalCompositeOperation = 'lighter';

            if(sprite.flipH)
            {
                ctx.translate(Math.round(sprite.x - minX), Math.round(sprite.y - minY));
                ctx.scale(-1, 1);
                ctx.drawImage(sprite.image, 0, 0);
            }
            else
            {
                ctx.drawImage(sprite.image, Math.round(sprite.x - minX), Math.round(sprite.y - minY));
            }

            ctx.restore();
        };

        for(const sprite of layout.back) drawSprite(sprite);

        ctx.drawImage(layout.image, Math.round(layout.x - minX), Math.round(layout.y - minY));

        for(const sprite of layout.front) drawSprite(sprite);

        frames.push(canvas);
    }

    return { frames, missingScaleAssets: avatar.missingScaleAssets };
}

// same math used by the Nitro AvatarVisualization to place the avatar and the effect sprites
const BuildFrameLayout = (avatar: IAvatarImage, image: Canvas, scale: number): IFrameLayout =>
{
    const direction = avatar.getDirection();
    const canvasOffsets = (avatar.getCanvasOffsets() || [ 0, 0, 0 ]);
    const footX = ((image.width / 2) - (canvasOffsets[0] || 0));
    const footY = ((image.height - (scale / 4)) - (canvasOffsets[1] || 0));
    const layout: IFrameLayout = { image, x: 0, y: 0, back: [], front: [] };

    for(const sprite of (avatar.getSprites() || []))
    {
        if(sprite.id === 'avatar')
        {
            const [ offsetX, offsetY ] = GetSpriteOffset(avatar, sprite, direction, scale);

            layout.x = offsetX;
            layout.y = offsetY;

            continue;
        }

        const layerData = avatar.getLayerData(sprite);

        let frame = 0;
        let dd = (sprite.hasDirections ? direction : 0);

        if(layerData)
        {
            frame = layerData.animationFrame;
            dd += layerData.dd;
        }

        if(dd < 0) dd += 8;
        else if(dd > 7) dd -= 8;

        const asset = avatar.getAsset(`${ avatar.getScale() }_${ sprite.member }_${ dd }_${ frame }`);

        if(!asset || !asset.texture) continue;

        const [ offsetX, offsetY ] = GetSpriteOffset(avatar, sprite, direction, scale);
        const offsetZ = sprite.getDirectionOffsetZ(direction);

        const draw: ISpriteDraw = {
            image: asset.texture.drawableCanvas,
            x: (footX + (asset.offsetX - (scale / 2)) + offsetX),
            y: (footY + asset.offsetY + offsetY),
            z: offsetZ,
            flipH: asset.flipH,
            additive: (sprite.ink === 33)
        };

        if(offsetZ < 0) layout.back.push(draw);
        else layout.front.push(draw);
    }

    layout.back.sort((a, b) => (a.z - b.z));
    layout.front.sort((a, b) => (a.z - b.z));

    return layout;
}

const GetSpriteOffset = (avatar: IAvatarImage, sprite: ISpriteDataContainer, direction: number, scale: number): [ number, number ] =>
{
    const layerData = avatar.getLayerData(sprite);

    let offsetX = sprite.getDirectionOffsetX(direction);
    let offsetY = sprite.getDirectionOffsetY(direction);

    if(layerData)
    {
        offsetX += layerData.dx;
        offsetY += layerData.dy;
    }

    if(scale < 48)
    {
        offsetX /= 2;
        offsetY /= 2;
    }

    return [ offsetX, offsetY ];
}

// The renderer uses a 90x130 canvas (room for pets / misc parts), the classic imager output is 64x110
const GetBaseRect = (image: Canvas, scaleType: string) =>
{
    if((scaleType === AvatarScaleType.LARGE) && (image.width === 90) && (image.height === 130)) return { x: 13, y: 14, width: 64, height: 110 };

    return { x: 0, y: 0, width: image.width, height: image.height };
}

const OPAQUE_BOUNDS_CACHE: WeakMap<Canvas, { x: number, y: number, width: number, height: number }> = new WeakMap();

const GetOpaqueBounds = (image: Canvas) =>
{
    if(!image || !image.width || !image.height) return null;

    if(OPAQUE_BOUNDS_CACHE.has(image)) return OPAQUE_BOUNDS_CACHE.get(image);

    const pixels = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;

    let minX = image.width, minY = image.height, maxX = -1, maxY = -1;

    for(let y = 0; y < image.height; y++)
    {
        for(let x = 0; x < image.width; x++)
        {
            if(!pixels[(((y * image.width) + x) * 4) + 3]) continue;

            if(x < minX) minX = x;
            if(x > maxX) maxX = x;
            if(y < minY) minY = y;
            if(y > maxY) maxY = y;
        }
    }

    const bounds = ((maxX < 0) ? null : { x: minX, y: minY, width: ((maxX - minX) + 1), height: ((maxY - minY) + 1) });

    OPAQUE_BOUNDS_CACHE.set(image, bounds);

    return bounds;
}
