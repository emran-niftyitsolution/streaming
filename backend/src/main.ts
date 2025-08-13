import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: 'http://localhost:3001', // Next.js default port
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 5001);
}
bootstrap();
