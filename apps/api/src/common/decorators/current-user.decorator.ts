import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TokenPayload } from '@vetify/types';

/** The payload of the access token, left on the request by the JWT strategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TokenPayload | undefined =>
    context.switchToHttp().getRequest<{ user?: TokenPayload }>().user,
);
