import { IAssetManager } from '../../core';

export class AvatarAssetDownloadLibrary
{
    private static NOT_LOADED: number = 0;
    private static LOADING: number = 1;
    private static LOADED: number = 2;

    private _state: number;
    private _libraryName: string;
    private _revision: string;
    private _downloadUrl: string;
    private _assets: IAssetManager;

    constructor(id: string, revision: string, assets: IAssetManager, assetUrl: string)
    {
        this._state = AvatarAssetDownloadLibrary.NOT_LOADED;
        this._libraryName = id;
        this._revision = revision;
        this._downloadUrl = assetUrl;
        this._assets = assets;

        this._downloadUrl = this._downloadUrl.replace(/%libname%/gi, this._libraryName);
        this._downloadUrl = this._downloadUrl.replace(/%revision%/gi, this._revision);

        this.checkIfAssetLoaded();
    }

    private checkIfAssetLoaded(): boolean
    {
        if(this._state === AvatarAssetDownloadLibrary.LOADED) return true;

        const asset = this._assets.getCollection(this._libraryName);

        if(asset)
        {
            this._state = AvatarAssetDownloadLibrary.LOADED;

            return true;
        }

        return false;
    }

    private _downloadPromise: Promise<boolean> = null;

    public async downloadAsset(): Promise<boolean>
    {
        if(!this._assets) return false;

        if(this.checkIfAssetLoaded()) return false;

        // several requests may need the same library at the same time: all of them wait for the same download
        if(this._downloadPromise) return this._downloadPromise;

        this._state = AvatarAssetDownloadLibrary.LOADING;

        this._downloadPromise = (async () =>
        {
            try
            {
                const success = await this._assets.downloadAsset(this._downloadUrl);

                this._state = (success ? AvatarAssetDownloadLibrary.LOADED : AvatarAssetDownloadLibrary.NOT_LOADED);

                return success;
            }

            catch(err)
            {
                this._state = AvatarAssetDownloadLibrary.NOT_LOADED;

                return false;
            }

            finally
            {
                this._downloadPromise = null;
            }
        })();

        return this._downloadPromise;
    }

    public get libraryName(): string
    {
        return this._libraryName;
    }

    public get isLoaded(): boolean
    {
        return (this._state === AvatarAssetDownloadLibrary.LOADED);
    }
}
