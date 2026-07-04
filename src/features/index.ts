// @ts-nocheck
import { createAuthRouter } from './auth/routes';
import { createMessagesRouter } from './messages/routes';
import { createModerationRouter } from './moderation/routes';
import { createNotificationsRouter } from './notifications/routes';
import { createPostsRouter } from './posts/routes';
import { createSearchRouter } from './search/routes';
import { createUploadsRouter } from './uploads/routes';
import { createUsersRouter } from './users/routes';

export const featureRegistry = [
  { name: 'auth', mountPath: '/api/auth', createRouter: createAuthRouter },
  { name: 'uploads', mountPath: '/api', createRouter: createUploadsRouter },
  { name: 'users', mountPath: '/api', createRouter: createUsersRouter },
  { name: 'posts', mountPath: '/api', createRouter: createPostsRouter },
  { name: 'notifications', mountPath: '/api', createRouter: createNotificationsRouter },
  { name: 'search', mountPath: '/api', createRouter: createSearchRouter },
  { name: 'moderation', mountPath: '/api', createRouter: createModerationRouter },
  { name: 'messages', mountPath: '/api', createRouter: createMessagesRouter }
];

export function registerFeatures(app, context, features = featureRegistry) {
  for (const feature of features) {
    app.use(feature.mountPath, feature.createRouter(context));
  }
}
