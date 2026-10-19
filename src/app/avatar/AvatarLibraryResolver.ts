import { IFigurePart, IFigurePartSet } from './structure';

export class AvatarLibraryResolver
{
    private static OFFICIAL_PREFIX: string = 'hh_';

    private _partLibraries: Map<string, string[]> = new Map();
    private _libraryParts: Map<string, Set<string>> = new Map();
    private _libraryOrder: Map<string, number> = new Map();
    private _setCache: WeakMap<IFigurePartSet, Map<string, string[]>> = new WeakMap();

    public static getPartKey(type: string, id: string | number): string
    {
        return (type + ':' + id);
    }

    public static getFamily(libraryName: string): string
    {
        return libraryName.replace('_50_', '_');
    }

    public addLibrary(libraryName: string, parts: { id: string | number, type: string }[]): void
    {
        if(!libraryName || !parts || this._libraryOrder.has(libraryName)) return;

        this._libraryOrder.set(libraryName, this._libraryOrder.size);

        const ownedParts = new Set<string>();

        for(const part of parts)
        {
            if(!part) continue;

            const key = AvatarLibraryResolver.getPartKey(part.type, part.id);

            ownedParts.add(key);

            let libraries = this._partLibraries.get(key);

            if(!libraries)
            {
                libraries = [];

                this._partLibraries.set(key, libraries);
            }

            libraries.push(libraryName);
        }

        this._libraryParts.set(libraryName, ownedParts);
    }

    public getPartLibraries(type: string, id: string | number): string[]
    {
        return (this._partLibraries.get(AvatarLibraryResolver.getPartKey(type, id)) || null);
    }

    public isConflictingPart(type: string, id: string | number): boolean
    {
        const libraries = this._partLibraries.get(AvatarLibraryResolver.getPartKey(type, id));

        if(!libraries || (libraries.length < 2)) return false;

        if(libraries.every(library => library.startsWith(AvatarLibraryResolver.OFFICIAL_PREFIX))) return false;

        const family = AvatarLibraryResolver.getFamily(libraries[0]);

        return libraries.some(library => (AvatarLibraryResolver.getFamily(library) !== family));
    }

    public getSetPartLibraries(set: IFigurePartSet, part: IFigurePart): string[]
    {
        if(!set || !part) return null;

        const key = AvatarLibraryResolver.getPartKey(part.type, part.id);
        const candidates = this._partLibraries.get(key);

        if(!candidates || (candidates.length < 2)) return (candidates || null);

        let cache = this._setCache.get(set);

        if(!cache)
        {
            cache = new Map();

            this._setCache.set(set, cache);
        }

        let resolved = cache.get(key);

        if(resolved) return resolved;

        resolved = this.rankLibraries(set, candidates);

        cache.set(key, resolved);

        return resolved;
    }

    public getRequiredLibraries(set: IFigurePartSet, part: IFigurePart): string[]
    {
        const libraries = this.getSetPartLibraries(set, part);

        if(!libraries || (libraries.length < 2)) return libraries;

        const family = AvatarLibraryResolver.getFamily(libraries[0]);

        return libraries.filter(library => (AvatarLibraryResolver.getFamily(library) === family));
    }

    private rankLibraries(set: IFigurePartSet, candidates: string[]): string[]
    {
        const preferred = set.library ? set.library.toLowerCase() : null;
        const scores = new Map<string, number>();

        for(const library of candidates)
        {
            const ownedParts = this._libraryParts.get(library);

            let score = 0;

            if(ownedParts) for(const part of set.parts) ownedParts.has(AvatarLibraryResolver.getPartKey(part.type, part.id)) && score++;

            scores.set(library, score);
        }

        return [ ...candidates ].sort((a, b) =>
        {
            if(preferred)
            {
                const aPreferred = (AvatarLibraryResolver.getFamily(a).toLowerCase() === AvatarLibraryResolver.getFamily(preferred));
                const bPreferred = (AvatarLibraryResolver.getFamily(b).toLowerCase() === AvatarLibraryResolver.getFamily(preferred));

                if(aPreferred !== bPreferred) return (aPreferred ? -1 : 1);
            }

            const scoreDiff = (scores.get(b) - scores.get(a));

            if(scoreDiff) return scoreDiff;

            const aOfficial = a.startsWith(AvatarLibraryResolver.OFFICIAL_PREFIX);
            const bOfficial = b.startsWith(AvatarLibraryResolver.OFFICIAL_PREFIX);

            if(aOfficial !== bOfficial) return (aOfficial ? -1 : 1);

            return (this._libraryOrder.get(a) - this._libraryOrder.get(b));
        });
    }
}
