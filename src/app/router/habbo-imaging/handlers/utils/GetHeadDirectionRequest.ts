import { ParseDirection } from './GetDirectionRequest';
import { RequestQuery } from './RequestQuery';

export const GetHeadDirectionRequest = (query: RequestQuery) =>
{
    return ParseDirection(query.head_direction);
}
