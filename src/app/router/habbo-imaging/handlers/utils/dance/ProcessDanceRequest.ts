import { AvatarAction, IAvatarImage } from '../../../../../avatar';
import { GetDanceRequest } from '../GetDanceRequest';
import { RequestQuery } from '../RequestQuery';

export const ProcessDanceRequest = (query: RequestQuery, avatar: IAvatarImage) =>
{
    const dance = GetDanceRequest(query);

    // 1-4 are the default dances, 5+ are the Hubbe custom dances
    if(!dance) return;

    avatar.appendAction(AvatarAction.DANCE, dance);
}
