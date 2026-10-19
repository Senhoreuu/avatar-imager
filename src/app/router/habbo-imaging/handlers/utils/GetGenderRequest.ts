import { RequestQuery } from './RequestQuery';

export const GetGenderRequest = (query: RequestQuery) =>
{
    const gender = (query.gender || 'M').toString().toUpperCase();

    return ((gender === 'F') ? 'F' : 'M');
}
