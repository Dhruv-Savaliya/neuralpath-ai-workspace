import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origins = (config.get<string>("WEB_ORIGINS") ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // Vercel creates a unique hostname for each preview deployment. Allow only
  // this project's deployment hostnames, not arbitrary *.vercel.app origins.
  const isNeuralPathVercelPreview = (origin: string) =>
    /^https:\/\/neuralpath-ai-workspace(?:-[a-z0-9-]+)?-dhruv-savaliyas-projects\.vercel\.app$/.test(origin);

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || origins.includes(origin) || isNeuralPathVercelPreview(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS."), false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
  });

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();
  await app.listen(config.get<number>("PORT") ?? 4000, "0.0.0.0");
}

void bootstrap();
