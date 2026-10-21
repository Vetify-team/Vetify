import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';

/** No controller yet: nothing is exposed until the module is implemented. */
@Module({ providers: [AiService], exports: [AiService] })
export class AiModule {}
