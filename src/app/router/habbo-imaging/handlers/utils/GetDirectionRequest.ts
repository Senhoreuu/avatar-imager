import { RequestQuery } from './RequestQuery';

export const ParseDirection = (value: string): number =>
{
    if(!value || !value.length) return null;

    const direction = parseInt(value);

    if(isNaN(direction)) return null;

    return (((direction % 8) + 8) % 8);
}

export const GetDirectionRequest = (query: RequestQuery) =>
{
    return ParseDirection(query.direction);
}
