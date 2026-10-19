import { AvatarAction, IAvatarImage } from '../../../../../avatar';

export const ProcessPostureAction = (action: string, avatar: IAvatarImage) =>
{
    if(!action || !action.length) return false;

    const [ key, value ] = action.split('=');
    const param = ((value && value.length) ? value : null);

    let posture: string = null;

    switch(key)
    {
        case 'wlk':
        case AvatarAction.POSTURE_WALK:
            posture = AvatarAction.POSTURE_WALK;
            break;
        case AvatarAction.POSTURE_SIT:
        case AvatarAction.POSTURE_LAY:
        case AvatarAction.POSTURE_STAND:
        case AvatarAction.POSTURE_FLOAT:
        case AvatarAction.POSTURE_SWIM:
            posture = key;
            break;
    }

    if(!posture) return false;

    avatar.appendAction(AvatarAction.POSTURE, posture, param);

    return true;
}
