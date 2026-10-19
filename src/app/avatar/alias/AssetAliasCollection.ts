import { AdvancedMap, IAssetManager, IGraphicAsset } from '../../../core';
import { AvatarRenderManager } from '../AvatarRenderManager';
import { AssetAlias } from './AssetAlias';

export class AssetAliasCollection
{
    private _assets: IAssetManager;
    private _aliases: AdvancedMap<string, AssetAlias>;
    private _avatarRenderManager: AvatarRenderManager;
    private _missingAssetNames: string[];

    constructor(renderManager: AvatarRenderManager, assetManager: IAssetManager)
    {
        this._avatarRenderManager = renderManager;
        this._aliases = new AdvancedMap();
        this._assets = assetManager;
        this._missingAssetNames = [];
    }

    public dispose(): void
    {
        this._assets = null;
        this._aliases = null;
    }

    public reset(): void
    {
        this.init();
    }

    private _indexedCollections: number = 0;

    public init(): void
    {
        this._indexedCollections = 0;

        this.indexNewCollections();
    }

    // libraries are downloaded on demand, so aliases must be indexed whenever a new collection appears
    private indexNewCollections(): void
    {
        if(!this._assets) return;

        const collections = this._assets.collections;

        if(collections.length === this._indexedCollections) return;

        const values = collections.getValues();

        for(let i = this._indexedCollections; i < values.length; i++)
        {
            const collection = values[i];

            if(!collection) continue;

            const aliases = collection.data && collection.data.aliases;

            if(!aliases) continue;

            for(const name in aliases)
            {
                const alias = aliases[name];

                if(!alias) continue;

                // first library wins, same as the asset lookup order
                if(!this._aliases.getValue(name)) this._aliases.add(name, new AssetAlias(name, alias));
            }
        }

        this._indexedCollections = values.length;
    }

    public hasAlias(name: string): boolean
    {
        this.indexNewCollections();

        const alias = this._aliases.getValue(name);

        if(alias) return true;

        return false;
    }

    public getAssetName(k: string): string
    {
        let linkName = k;
        let tries = 5;

        while(this.hasAlias(linkName) && (tries >= 0))
        {
            const alias = this._aliases.getValue(linkName);

            linkName = alias.link;
            tries--;
        }

        return linkName;
    }

    public getAssetFromLibraries(name: string, libraries: string[], strict: boolean = false): IGraphicAsset
    {
        if(!this._assets || !name) return null;

        if(libraries && libraries.length)
        {
            let hasCollection = false;

            for(const library of libraries)
            {
                const collection = this._assets.getCollection(library);

                if(!collection) continue;

                hasCollection = true;

                const aliases = (collection.data && collection.data.aliases);

                let assetName = name;
                let depth = 5;

                while(aliases && aliases[assetName] && aliases[assetName].link && (depth >= 0))
                {
                    assetName = aliases[assetName].link;
                    depth--;
                }

                const asset = collection.getAsset(assetName);

                if(asset) return asset;
            }

            if(strict && hasCollection) return null;
        }

        return this.getAsset(name);
    }

    public getAsset(name: string): IGraphicAsset
    {
        if(!this._assets) return null;

        name = this.getAssetName(name);

        const asset = this._assets.getAsset(name);

        if(!asset) return null;

        return asset;
    }
}
