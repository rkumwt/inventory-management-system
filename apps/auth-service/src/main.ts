import { bootstrapHttpService } from '@ims/common';
import { AppModule } from './app.module';
import { env } from './config/env';

void bootstrapHttpService(AppModule, {
  serviceName: 'auth-service',
  description: 'Users, login, token refresh and logout.',
  port: env.PORT,
});
