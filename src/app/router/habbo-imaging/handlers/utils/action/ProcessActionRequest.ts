import { AvatarAction, IAvatarImage } from '../../../../../avatar';
import { GetActionRequest } from '../GetActionRequest';
import { RequestQuery } from '../RequestQuery';
import { ProcessCarryAction } from './ProcessCarryAction';
import { ProcessExpressionAction } from './ProcessExpressionAction';
import { ProcessPostureAction } from './ProcessPostureAction';

export const ProcessActionRequest = (query: RequestQuery, avatar: IAvatarImage) =>
{
    const actions = (GetActionRequest(query)?.split(',') || []);

    let hasPosture = false;

    for(const rawAction of actions)
    {
        const action = rawAction.trim();

        if(!action.length) continue;

        // only one posture, like the client
        if(!hasPosture && ProcessPostureAction(action, avatar))
        {
            hasPosture = true;

            continue;
        }

        if(ProcessExpressionAction(action, avatar)) continue;

        if(ProcessCarryAction(action, avatar)) continue;
    }

    // the client ALWAYS sends a posture: many effects override it (float, rides, etc) and break without it
    if(!hasPosture) avatar.appendAction(AvatarAction.POSTURE, AvatarAction.POSTURE_STAND);
}
