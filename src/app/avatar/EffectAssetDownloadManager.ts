import { AdvancedMap, FileUtilities, IAssetManager } from '../../core';
import { Application } from '../Application';
import { AvatarStructure } from './AvatarStructure';
import { compileAnimationShorthand, HubbeCustomDances } from './data';
import { EffectAssetDownloadLibrary } from './EffectAssetDownloadLibrary';

export class EffectAssetDownloadManager
{
    private _assets: IAssetManager;
    private _structure: AvatarStructure;

    private _missingMandatoryLibs: string[];
    private _effectMap: AdvancedMap<string, EffectAssetDownloadLibrary[]>;
    private _libraryNames: string[];

    constructor(assets: IAssetManager, structure: AvatarStructure)
    {
        this._assets = assets;
        this._structure = structure;

        this._missingMandatoryLibs = Application.instance.getConfiguration<string[]>('avatar.mandatory.effect.libraries');
        this._effectMap = new AdvancedMap();
        this._libraryNames = [];
    }

    public async loadEffectMap(): Promise<void>
    {
        const url = (process.env.AVATAR_EFFECTMAP_URL as string);

        if(!url || !url.length) return Promise.reject('invalid_effectmap_url');

        const data = await FileUtilities.readFileAsString(url);
        const json = JSON.parse(data);

        this.processEffectMap(json.effects);

        this.registerCustomDances();

        await this.processMissingLibraries();
    }

    private processEffectMap(data: any): void
    {
        if(!data) return;

        const url = (process.env.AVATAR_ASSET_EFFECT_URL as string);

        if(!url || !url.length) return;

        const librariesByName: Map<string, EffectAssetDownloadLibrary> = new Map();

        for(const effect of data)
        {
            if(!effect) continue;

            const id = (effect.id as string);
            const lib = (effect.lib as string);
            const revision = (effect.revision || '');

            if(!lib) continue;

            // several effect ids can share the same library: all of them must point to it
            let downloadLibrary = librariesByName.get(lib);

            if(!downloadLibrary)
            {
                this._libraryNames.push(lib);

                downloadLibrary = new EffectAssetDownloadLibrary(lib, revision, this._assets, url);

                librariesByName.set(lib, downloadLibrary);
            }

            let existing = this._effectMap.getValue(id);

            if(!existing)
            {
                existing = [];

                this._effectMap.add(id, existing);
            }

            if(existing.indexOf(downloadLibrary) === -1) existing.push(downloadLibrary);
        }
    }

    private registerCustomDances(): void
    {
        for(const [ key, code ] of Object.entries(HubbeCustomDances))
        {
            try
            {
                const animation: any = {
                    ['Dance ' + key]: {
                        name: ('dance.' + key),
                        desc: ('Dance ' + key),
                        frames: compileAnimationShorthand(code)
                    }
                };

                this._structure.registerAnimation(animation);
            }

            catch(err)
            {
                Application.instance.logger.error(`Invalid custom dance ${ key }: ${ err.message }`);
            }
        }
    }

    public async downloadAvatarEffect(id: number): Promise<void>
    {
        const pendingLibraries = this.getAvatarEffectPendingLibraries(id);

        for(const library of pendingLibraries) (library && await this.downloadLibrary(library));
    }

    public async processMissingLibraries(): Promise<void>
    {
        const missingLibraries = this._missingMandatoryLibs.slice();

        for(const library of missingLibraries)
        {
            if(!library) continue;

            const libraries = this._effectMap.getValue(library);

            if(libraries) for(const library of libraries) (library && await this.downloadLibrary(library));
        }
    }

    public isAvatarEffectReady(effect: number): boolean
    {
        const pendingLibraries = this.getAvatarEffectPendingLibraries(effect);

        return !pendingLibraries.length;
    }

    private getAvatarEffectPendingLibraries(id: number): EffectAssetDownloadLibrary[]
    {
        const pendingLibraries: EffectAssetDownloadLibrary[] = [];

        if(!this._structure) return pendingLibraries;

        const libraries = this._effectMap.getValue(id.toString());

        if(libraries)
        {
            for(const library of libraries)
            {
                if(!library || library.isLoaded) continue;

                if(pendingLibraries.indexOf(library) === -1) pendingLibraries.push(library);
            }
        }

        return pendingLibraries;
    }

    private async downloadLibrary(library: EffectAssetDownloadLibrary): Promise<void>
    {
        if(!library || library.isLoaded) return;

        if(!await library.downloadAsset()) return;

        this.registerLibraryAnimations(library);
    }

    // a library can carry more than one animation (the renderer only registers the first one)
    private registerLibraryAnimations(library: EffectAssetDownloadLibrary): void
    {
        const animations = library.animation;

        if(!animations) return;

        for(const key of Object.keys(animations))
        {
            const animation = animations[key];

            if(!animation || !animation.name) continue;

            if(this._structure.animationManager.getAnimation(animation.name)) continue;

            this._structure.registerAnimation({ [key]: animation });
        }
    }
}
