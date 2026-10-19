import { readFile } from 'fs';
import fetch from 'node-fetch';
import { promisify } from 'util';
import { File } from './File';

const readFileAsync = promisify(readFile);

export class FileUtilities
{
    public static getDirectory(baseFolderPath: string, childFolderName: string = null): File
    {
        let folder = new File(baseFolderPath);

        if(!folder.isDirectory()) folder.mkdirs();

        if(childFolderName)
        {
            folder = new File(folder.path + childFolderName);

            if(!folder.isDirectory()) folder.mkdirs();
        }

        return folder;
    }

    public static async readFileAsBuffer(url: string): Promise<Buffer>
    {
        if(!url) return null;

        let content: Buffer = null;

        if(url.startsWith('//')) url = ('https:' + url);

        if(url.startsWith('http'))
        {
            const data = await fetch(url);

            // do not rely on the Content-Type (CDNs often serve .nitro as binary/octet-stream, application/x-nitro, etc)
            if(!data.ok) throw new Error(`HTTP ${ data.status } for ${ url }`);

            const contentType = (data.headers.get('Content-Type') || '');

            if(contentType.startsWith('text/html')) throw new Error(`Unexpected HTML response for ${ url }`);

            const arrayBuffer = await data.arrayBuffer();

            if(arrayBuffer) content = Buffer.from(arrayBuffer);
        }
        else
        {
            content = await readFileAsync(url);
        }

        return content;
    }

    public static async readFileAsString(url: string): Promise<string>
    {
        if(!url) return null;

        let content = null;

        if(url.startsWith('//')) url = ('https:' + url);

        if(url.startsWith('http'))
        {
            const data = await fetch(url);

            if(!data.ok) return null;

            content = await data.text();
        }
        else
        {
            const data = await readFileAsync(url);

            content = data.toString('utf-8');
        }

        // strip UTF-8 BOM (JSON.parse fails on it)
        if(content && (content.charCodeAt(0) === 0xFEFF)) content = content.substring(1);

        return content;
    }
}
