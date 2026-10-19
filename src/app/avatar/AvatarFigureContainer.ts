import { IAvatarFigureContainer } from './IAvatarFigureContainer';

interface IFigurePartEntry
{
    type: string;
    setId: number;
    colorIds: number[];
}

/**
 * Supports more than one item per set type (ex: "ha-1001-1.ha-1002-1"),
 * exactly like the Hubbe renderer does.
 */
export class AvatarFigureContainer implements IAvatarFigureContainer
{
    private _parts: Map<string, IFigurePartEntry[]>;

    constructor(figure: string)
    {
        this._parts = new Map();

        this.parseFigure(figure);
    }

    public getPartTypeIds(): string[]
    {
        return Array.from(this._parts.keys());
    }

    public hasPartType(k: string): boolean
    {
        const existing = this._parts.get(k);

        return !!(existing && existing.length);
    }

    public getPartCount(k: string): number
    {
        const existing = this._parts.get(k);

        return (existing ? existing.length : 0);
    }

    public getPartSetId(k: string, index: number = 0): number
    {
        const existing = this._parts.get(k);

        if(!existing || !existing[index]) return 0;

        return existing[index].setId;
    }

    public getPartColorIds(k: string, index: number = 0): number[]
    {
        const existing = this._parts.get(k);

        if(!existing || !existing[index]) return null;

        return existing[index].colorIds;
    }

    public updatePart(setType: string, partSetId: number, colorIds: number[], index: number = 0): void
    {
        let existing = this._parts.get(setType);

        if(!existing)
        {
            existing = [];

            this._parts.set(setType, existing);
        }

        existing[index] = { type: setType, setId: partSetId, colorIds };
    }

    public appendPart(setType: string, partSetId: number, colorIds: number[]): void
    {
        let existing = this._parts.get(setType);

        if(!existing)
        {
            existing = [];

            this._parts.set(setType, existing);
        }

        existing.push({ type: setType, setId: partSetId, colorIds });
    }

    public removePart(k: string): void
    {
        this._parts.delete(k);
    }

    public getFigureString(): string
    {
        const parts: string[] = [];

        for(const [ key, entries ] of this._parts)
        {
            if(!key || !entries) continue;

            for(const entry of entries)
            {
                if(!entry) continue;

                parts.push([ key, entry.setId, ...entry.colorIds ].join('-'));
            }
        }

        return parts.join('.');
    }

    private parseFigure(figure: string): void
    {
        if(!figure) figure = '';

        for(const part of figure.split('.'))
        {
            const pieces = part.trim().split('-');

            if(pieces.length < 2) continue;

            const type = pieces[0];
            const setId = parseInt(pieces[1]);

            if(!type || isNaN(setId)) continue;

            const colors: number[] = [];

            for(let index = 2; index < pieces.length; index++)
            {
                // custom colors may come as plain RGB ints (ex: 16711680) or hex (#ff0000 / ff0000)
                colors.push(AvatarFigureContainer.parseColorId(pieces[index]));
            }

            this.appendPart(type, setId, colors);
        }
    }

    public static parseColorId(value: string): number
    {
        if(!value || !value.length) return NaN;

        if(value.startsWith('#')) return parseInt(value.substring(1), 16);

        if(/^\d+$/.test(value)) return parseInt(value, 10);

        if(/^[0-9a-f]{6}$/i.test(value)) return parseInt(value, 16);

        return parseInt(value, 10);
    }
}
