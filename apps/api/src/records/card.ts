import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  clinicCardSchema,
  type ClinicCard,
  type TokenPayload,
} from '@vetify/types';
import { z } from 'zod';
import type { Env } from '../config.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { notFound } from '../common/errors.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ZodBody, ZodResponse } from '../common/openapi/zod-openapi.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { PetsService } from '../pets/pets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VaccinationStatusService } from './vaccination-status.service.js';

const verifySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/),
});
@Injectable()
export class CardService {
  constructor(
    private readonly db: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly status: VaccinationStatusService,
    private readonly config: ConfigService<Env, true>,
    private readonly pets: PetsService,
  ) {}

  /**
   * The vaccination cards of the clinic's patients, card-only ones included:
   * name, species and recorded doses, as on the public card. Each pet listed
   * is logged under `view_card`.
   */
  async forClinic(user: TokenPayload): Promise<ClinicCard[]> {
    const pets = await this.pets.listVisible(user, 'view_card', {
      cards: true,
    });
    const ids = pets.map((p) => p.id);
    const [statuses, full] = await Promise.all([
      this.status.computeStatuses(pets),
      this.permissions.fullAccess(user, ids),
    ]);
    return pets.map((pet) => ({
      petId: pet.id,
      name: pet.name,
      species: pet.species,
      fullAccess: full.has(pet.id),
      vaccines: statuses
        .get(pet.id)!
        .vaccines.filter((v) => v.lastAppliedOn)
        .map(({ vaccine, status, lastAppliedOn, expiresOn }) => ({
          vaccine,
          status,
          lastAppliedOn,
          expiresOn,
        })),
    }));
  }

  private token(nonce: string): string {
    const mac = createHmac(
      'sha256',
      this.config.get('LINK_CODE_SECRET', { infer: true }),
    )
      .update('vetify-public-card-v1:')
      .update(nonce)
      .digest('base64url');
    return `${nonce}.${mac}`;
  }
  async current(user: TokenPayload, petId: string) {
    await this.permissions.authorize(user, petId, 'administer');
    const link = await this.db.cardLink.findUnique({ where: { petId } });
    return { token: link ? this.token(link.nonce) : null };
  }
  async rotate(user: TokenPayload, petId: string) {
    await this.permissions.authorize(user, petId, 'administer');
    const nonce = randomBytes(32).toString('base64url');
    await this.db.cardLink.upsert({
      where: { petId },
      create: { petId, nonce },
      update: { nonce },
    });
    return { token: this.token(nonce) };
  }
  async revoke(user: TokenPayload, petId: string) {
    await this.permissions.authorize(user, petId, 'administer');
    await this.db.cardLink.deleteMany({ where: { petId } });
    return { revoked: true };
  }
  async verify(token: string) {
    const nonce = token.split('.')[0]!;
    const expected = Buffer.from(this.token(nonce));
    const supplied = Buffer.from(token);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw notFound('Card not found');
    const link = await this.db.cardLink.findUnique({
      where: { nonce },
      include: { pet: true },
    });
    if (!link) throw notFound('Card not found');
    const status = (await this.status.computeStatuses([link.pet])).get(
      link.petId,
    )!;
    return {
      name: link.pet.name,
      vaccines: status.vaccines.map(
        ({ vaccine, status, lastAppliedOn, expiresOn }) => ({
          vaccine,
          status,
          lastAppliedOn,
          expiresOn,
        }),
      ),
    };
  }
}

@ApiTags('vaccination card')
@Controller({ version: '1' })
export class CardController {
  constructor(private readonly cards: CardService) {}
  @Roles('clinic')
  @ApiBearerAuth()
  @Get('clinics/mine/cards')
  @ApiOperation({
    summary: "Vaccination cards of the clinic's patients",
    description:
      'Every pet with an active permission, full or card-only: name, species and recorded doses only. Each pet is logged under view_card.',
  })
  @ZodResponse('ClinicCard', clinicCardSchema, { list: true })
  clinicCards(@CurrentUser() user: TokenPayload): Promise<ClinicCard[]> {
    return this.cards.forClinic(user);
  }
  @Roles('owner')
  @ApiBearerAuth()
  @Get('pets/:petId/card-link')
  @ApiOperation({ summary: 'Get the current public card link' })
  @ZodResponse('CardLink', z.object({ token: z.string().nullable() }))
  current(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.cards.current(user, petId);
  }
  @Roles('owner')
  @ApiBearerAuth()
  @Post('pets/:petId/card-link')
  @ApiOperation({ summary: 'Create or replace the public card link' })
  @ZodResponse('CreatedCardLink', z.object({ token: z.string() }), {
    status: 201,
  })
  rotate(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.cards.rotate(user, petId);
  }
  @Roles('owner')
  @ApiBearerAuth()
  @Delete('pets/:petId/card-link')
  @ApiOperation({ summary: 'Revoke the public card link' })
  @ZodResponse('RevokedCardLink', z.object({ revoked: z.boolean() }))
  revoke(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.cards.revoke(user, petId);
  }
  @Public()
  @Post('card/verify')
  @ApiOperation({ summary: 'Verify a public vaccination card' })
  @ZodBody('VerifyCard', verifySchema)
  @ZodResponse(
    'PublicCard',
    z.object({
      name: z.string(),
      vaccines: z.array(
        z.object({
          vaccine: z.string(),
          status: z.enum([
            'valid',
            'expiring',
            'expired',
            'due',
            'not_yet_due',
          ]),
          lastAppliedOn: z.string().nullable(),
          expiresOn: z.string().nullable(),
        }),
      ),
    }),
    { status: 201 },
  )
  verify(
    @Body(new ZodValidationPipe(verifySchema))
    body: z.infer<typeof verifySchema>,
  ) {
    return this.cards.verify(body.token);
  }
}
