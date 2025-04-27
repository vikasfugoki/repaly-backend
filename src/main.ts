import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import 'dotenv/config';

import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { AuthService } from './modules/auth/auth.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
  });

  const config = new DocumentBuilder()
    .setTitle('NestJS DynamoDB API')
    .setDescription('API documentation for the NestJS app with DynamoDB')
    .setVersion('1.0')
    .addTag('nestjs')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(app.get(AuthService), reflector));

  await app.listen(+(process.env.PORT || '3000'));
  console.log(
    `\n\n Application is running on: ${(await app.getUrl()).replace('[::1]', 'localhost')} \n\n`,
  );
}
bootstrap();


// import { Handler, APIGatewayProxyEvent, Context } from 'aws-lambda';
// import { NestFactory, Reflector } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { ValidationPipe } from '@nestjs/common';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// import 'dotenv/config';
// import { ExpressAdapter } from '@nestjs/platform-express';
// import * as express from 'express';
// import * as serverless from 'aws-serverless-express';

// import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
// import { AuthService } from './modules/auth/auth.service';

// let app;
// let server;

// async function bootstrap() {
//   const expressApp = express();
//   app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

//   // Explicitly tell Express to parse JSON body
//   expressApp.use(express.json());

//   // Enable CORS
//   app.enableCors({
//     origin: '*',
//   });

//   // Swagger setup
//   const config = new DocumentBuilder()
//     .setTitle('NestJS DynamoDB API')
//     .setDescription('API documentation for the NestJS app with DynamoDB')
//     .setVersion('1.0')
//     .addTag('nestjs')
//     .build();
//   const document = SwaggerModule.createDocument(app, config);
//   SwaggerModule.setup('api', app, document);

//   // Global pipes for validation
//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//     }),
//   );

//   const reflector = app.get(Reflector);
//   app.useGlobalGuards(new JwtAuthGuard(app.get(AuthService), reflector));

//   await app.init();
//   server = serverless.createServer(expressApp);
// }

// export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
//   console.log('Raw event:', JSON.stringify(event, null, 2));
//   if (!server) {
//     await bootstrap();
//   }
//   return serverless.proxy(server, event, context, 'PROMISE').promise;
// };
