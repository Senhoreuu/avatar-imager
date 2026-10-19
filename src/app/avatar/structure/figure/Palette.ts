import { AdvancedMap } from '../../../../core';
import { IFigureDataPalette } from '../../interfaces';
import { IPalette } from './IPalette';
import { IPartColor } from './IPartColor';
import { PartColor } from './PartColor';

export class Palette implements IPalette
{
    private _id: number;
    private _colors: AdvancedMap<string, IPartColor>;

    constructor(data: IFigureDataPalette)
    {
        if(!data) throw new Error('invalid_data');

        this._id = data.id;
        this._colors = new AdvancedMap();

        this.append(data);
    }

    public append(data: IFigureDataPalette): void
    {
        for(const color of data.colors)
        {
            const newColor = new PartColor(color);

            this._colors.add(color.id.toString(), newColor);
        }
    }

    public getColor(id: number): IPartColor
    {
        if((id === undefined) || (id === null) || isNaN(id) || (id < 0)) return null;

        const existing = this._colors.getValue(id.toString());

        if(existing) return existing;

        // Hubbe custom colors: any id not present in the palette is a raw RGB value (0xRRGGBB)
        return Palette.getCustomColor(id);
    }

    private static CUSTOM_COLORS: Map<number, IPartColor> = new Map();

    public static getCustomColor(rgb: number): IPartColor
    {
        rgb = (Math.max(0, Math.min(0xFFFFFF, Math.floor(rgb))));

        let color = Palette.CUSTOM_COLORS.get(rgb);

        if(!color)
        {
            color = new PartColor({ id: rgb, index: 999999, club: 0, selectable: true, hexCode: rgb.toString(16).padStart(6, '0') });

            if(Palette.CUSTOM_COLORS.size > 50000) Palette.CUSTOM_COLORS.clear();

            Palette.CUSTOM_COLORS.set(rgb, color);
        }

        return color;
    }

    public get id(): number
    {
        return this._id;
    }

    public get colors(): AdvancedMap<string, IPartColor>
    {
        return this._colors;
    }
}
