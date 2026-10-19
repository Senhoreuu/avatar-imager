import { AvatarRenderManager } from '../../../../avatar';
import { RequestQuery } from './RequestQuery';

export const GetFigureRequest = (query: RequestQuery) =>
{
    let figure = AvatarRenderManager.DEFAULT_FIGURE;

    if(query.figure && (typeof query.figure === 'string') && query.figure.length) figure = query.figure.trim();

    return figure;
}
