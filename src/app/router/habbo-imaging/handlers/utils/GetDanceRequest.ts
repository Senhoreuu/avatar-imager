import { RequestQuery } from './RequestQuery';

export const GetDanceRequest = (query: RequestQuery) =>
{
    if(!query.dance || !query.dance.length) return null;

    const dance = parseInt(query.dance);

    return ((isNaN(dance) || (dance <= 0)) ? null : dance);
}
