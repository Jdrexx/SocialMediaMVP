import { createAuthRouter } from './auth/routes.js';
import { createPostsRouter } from './posts/routes.js';
import { createUsersRouter } from './users/routes.js';

export const featureRegistry = [
  {
    name: 'auth',
    mountPath: '/api/auth',
    createRouter: createAuthRouter
  },
  {
    name: 'users',
    mountPath: '/api',
    createRouter: createUsersRouter
  },
  {
    name: 'posts',
    mountPath: '/api',
    createRouter: createPostsRouter
  }
];

export function registerFeatures(app, context, features = featureRegistry) {
  for (const feature of features) {
    app.use(feature.mountPath, feature.createRouter(context));
  }
}
