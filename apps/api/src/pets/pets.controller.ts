import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  createPetSchema,
  petSchema,
  updatePetSchema,
  type CreatePet,
  type Pet,
  type TokenPayload,
  type UpdatePet,
} from '@vetify/types';
import { LogAccess } from '../access-log/access-log.interceptor.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PetsService } from './pets.service.js';

@ApiTags('pets')
@ApiBearerAuth()
@Roles('owner', 'clinic')
@Controller({ path: 'pets', version: '1' })
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Get()
  @ApiOperation({
    summary:
      "The owner's pets, or the clinic's patients with an active permission",
  })
  @ZodResponse('Pet', petSchema, { list: true })
  @ErrorResponses(401, 403)
  list(@CurrentUser() user: TokenPayload): Promise<Pet[]> {
    return this.pets.list(user);
  }

  @Roles('owner')
  @Post()
  @ApiOperation({ summary: 'Register a pet' })
  @ZodBody('CreatePet', createPetSchema)
  @ZodResponse('Pet', petSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  create(
    @CurrentUser() user: TokenPayload,
    @Body(new ZodValidationPipe(createPetSchema)) data: CreatePet,
  ): Promise<Pet> {
    return this.pets.create(user, data);
  }

  @Get(':petId')
  @LogAccess('view_pet', { dedupe: true })
  @ApiOperation({ summary: "A pet's profile" })
  @ApiParam({ name: 'petId', description: 'Pet id (UUID)' })
  @ZodResponse('Pet', petSchema)
  @ErrorResponses(401, 403, 404)
  get(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<Pet> {
    return this.pets.get(user, petId);
  }

  @Roles('owner')
  @Patch(':petId')
  @LogAccess('update_pet')
  @ApiOperation({
    summary: "Edit a pet's profile; omitted fields are left unchanged",
  })
  @ApiParam({ name: 'petId', description: 'Pet id (UUID)' })
  @ZodBody('UpdatePet', updatePetSchema)
  @ZodResponse('Pet', petSchema)
  @ErrorResponses(400, 401, 403, 404)
  update(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(updatePetSchema)) data: UpdatePet,
  ): Promise<Pet> {
    return this.pets.update(user, petId, data);
  }
}
