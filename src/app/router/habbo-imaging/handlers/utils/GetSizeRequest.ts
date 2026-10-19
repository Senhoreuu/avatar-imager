import { RequestQuery } from './RequestQuery';

export const GetSizeRequest = (query: RequestQuery) =>
{
    const size = (query.size || '').toString().toLowerCase();

    if(size === 's') return 0.5;

    if((size === 'l') || (size === 'b')) return 2;

    return 1;
}
