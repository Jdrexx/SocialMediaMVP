import { createAuthRouter } from './auth/routes.js';
import { createMessagesRouter } from './messages/routes.js';
import { createModerationRouter } from './moderation/routes.js';
import { createNotificationsRouter } from './notifications/routes.js';
import { createPostsRouter } from './posts/routes.js';
import { createSearchRouter } from './search/routes.js';
import { createUploadsRouter } from './uploads/routes.js';
import { createUsersRouter } from './users/routes.js';

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
