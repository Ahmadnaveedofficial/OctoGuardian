import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const logger = new Logger('MongoDB');

        return {
          uri: configService.getOrThrow<string>('MONGODB_URI'),

          connectionFactory: (connection: Connection) => {
            if (connection.readyState === ConnectionStates.connected) {
              logger.log('MongoDB is connected');
            }

            connection.on('connecting', () => {
              if (connection.readyState === ConnectionStates.connecting) {
                logger.log('MongoDB is connecting...');
              }
            });

            connection.on('connected', () => {
              if (connection.readyState === ConnectionStates.connected) {
                logger.log('MongoDB connected successfully');
              }
            });

            connection.on('disconnected', () => {
              if (connection.readyState === ConnectionStates.disconnected) {
                logger.warn('MongoDB disconnected');
              }
            });

            connection.on('reconnected', () => {
              if (connection.readyState === ConnectionStates.connected) {
                logger.log('MongoDB reconnected successfully');
              }
            });

            connection.on('error', (error) => {
              logger.error('MongoDB connection error', error);
            });

            return connection;
          },
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
