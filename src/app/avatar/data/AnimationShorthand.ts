// Port of compileAnimationShorthand (HubbeNitro/src/api/utils/AvatarUtilities.ts)
export interface IShorthandBodyPart
{
    id: string;
    frame: number;
    action?: string;
    dy: number;
    dd: number;
    dx: number;
    [key: string]: unknown;
}

interface IKeyframeBlock
{
    type: 'keyframe';
    bodyparts: IShorthandBodyPart[];
    repeatCount: number;
}

interface IInterpolateBlock
{
    type: 'interpolate';
}

type ParsedBlock = IKeyframeBlock | IInterpolateBlock;

export interface IShorthandFrame
{
    bodyparts: IShorthandBodyPart[];
}

export function compileAnimationShorthand(input: string): IShorthandFrame[]
{
    const result: IShorthandFrame[] = [];
    const blocks = input.trim().split(/\n\s*\n/);

    let speed: number = null;
    const savedBlocks: Record<string, IKeyframeBlock> = {};
    const parsedBlocks: ParsedBlock[] = [];

    for(const block of blocks)
    {
        if(block.trim() === '...')
        {
            parsedBlocks.push({ type: 'interpolate' });
            continue;
        }

        const lines = block.split('\n');
        let bodyparts: IShorthandBodyPart[] = [];
        let repeatCount: number = null;
        let ignoreBlock = false;
        let blockName: string = null;
        let defaultParts: string[] = [];
        let hasNormalParts = false;

        for(const rawLine of lines)
        {
            const line = rawLine.trim();

            if(!line || line.startsWith('#') || line.startsWith('//')) continue;

            const macroMatch = line.match(/^\{([\w-]+)\}$/);

            if(macroMatch)
            {
                if(hasNormalParts && !ignoreBlock)
                {
                    const newKeyframe: IKeyframeBlock = { type: 'keyframe', bodyparts: [ ...bodyparts ], repeatCount: (repeatCount ?? speed ?? 1) };

                    parsedBlocks.push(newKeyframe);

                    if(blockName) savedBlocks[blockName] = JSON.parse(JSON.stringify(newKeyframe));

                    bodyparts = [];
                    hasNormalParts = false;
                    blockName = null;
                }

                const name = macroMatch[1];

                if(savedBlocks[name]) parsedBlocks.push(JSON.parse(JSON.stringify(savedBlocks[name])));

                continue;
            }

            if(line.startsWith('name:'))
            {
                blockName = line.split(':')[1].trim();
                continue;
            }

            if(line.startsWith('speed:'))
            {
                ignoreBlock = true;
                speed = parseInt(line.split(':')[1], 10);
                continue;
            }

            if(line.startsWith('default:'))
            {
                defaultParts = line.split(':').slice(1);
                continue;
            }

            if(line.startsWith('repeat:'))
            {
                repeatCount = parseInt(line.split(':')[1], 10);
                continue;
            }

            hasNormalParts = true;

            const parts = line.split(':');
            const id = parts[0];
            const action = parts[1];

            const partData: IShorthandBodyPart = { id, frame: 0, ...(action ? { action } : {}), dy: 0, dd: 0, dx: 0 };

            const parseModifier = (modifier: string) =>
            {
                if(!modifier) return;

                const match = modifier.match(/^(dx|dy|dz|dd|frame)([-0-9]+)$/);

                if(match) partData[match[1]] = parseInt(match[2], 10);
            };

            for(const modifier of defaultParts) parseModifier(modifier);
            for(const modifier of parts.slice(2)) parseModifier(modifier);

            bodyparts.push(partData);
        }

        if(!ignoreBlock && hasNormalParts)
        {
            const newKeyframe: IKeyframeBlock = { type: 'keyframe', bodyparts, repeatCount: (repeatCount ?? speed ?? 1) };

            parsedBlocks.push(newKeyframe);

            if(blockName) savedBlocks[blockName] = JSON.parse(JSON.stringify(newKeyframe));
        }
    }

    for(let i = 0; i < parsedBlocks.length; i++)
    {
        const current = parsedBlocks[i];

        if(current.type === 'interpolate')
        {
            const prev = parsedBlocks[i - 1];
            const next = parsedBlocks[i + 1];

            if(!prev || (prev.type !== 'keyframe') || !next || (next.type !== 'keyframe')) continue;

            let maxSteps = 1;

            for(const prevPart of prev.bodyparts)
            {
                const nextPart = next.bodyparts.find(p => (p.id === prevPart.id));

                if(nextPart) maxSteps = Math.max(maxSteps, Math.abs(nextPart.dx - prevPart.dx), Math.abs(nextPart.dy - prevPart.dy), Math.abs(nextPart.dd - prevPart.dd), Math.abs(nextPart.frame - prevPart.frame));
            }

            for(let step = 1; step < maxSteps; step++)
            {
                const ratio = (step / maxSteps);

                const interpolated: IShorthandBodyPart[] = prev.bodyparts.map(prevPart =>
                {
                    const nextPart = next.bodyparts.find(p => (p.id === prevPart.id));

                    if(!nextPart) return { ...prevPart };

                    return {
                        ...prevPart,
                        dx: Math.round(prevPart.dx + (nextPart.dx - prevPart.dx) * ratio),
                        dy: Math.round(prevPart.dy + (nextPart.dy - prevPart.dy) * ratio),
                        dd: Math.round(prevPart.dd + (nextPart.dd - prevPart.dd) * ratio),
                        frame: Math.round(prevPart.frame + (nextPart.frame - prevPart.frame) * ratio)
                    };
                });

                const repeats = (speed ?? 1);

                for(let r = 0; r < repeats; r++) result.push({ bodyparts: JSON.parse(JSON.stringify(interpolated)) });
            }
        }
        else
        {
            for(let r = 0; r < current.repeatCount; r++) result.push({ bodyparts: JSON.parse(JSON.stringify(current.bodyparts)) });
        }
    }

    return result;
}
