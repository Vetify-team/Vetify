import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  consultationSchema,
  createConsultationSchema,
  createDewormingSchema,
  createExamSchema,
  createFeedingEntrySchema,
  createTreatmentSchema,
  createVaccinationSchema,
  createWeightEntrySchema,
  dewormingSchema,
  examSchema,
  feedingEntrySchema,
  medicalRecordSchema,
  recordQuerySchema,
  recordSectionSchema,
  treatmentSchema,
  vaccinationSchema,
  vaccinationStatusSchema,
  weightEntrySchema,
  type Consultation,
  type CreateConsultation,
  type CreateDeworming,
  type CreateExam,
  type CreateFeedingEntry,
  type CreateTreatment,
  type CreateVaccination,
  type CreateWeightEntry,
  type Deworming,
  type Exam,
  type FeedingEntry,
  type MedicalRecord,
  type RecordQuery,
  type TokenPayload,
  type Treatment,
  type Vaccination,
  type VaccinationStatus,
  type WeightEntry,
} from '@vetify/types';
import { LogAccess } from '../access-log/access-log.interceptor.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import {
  IdempotencyKey,
  IdempotentWrite,
} from '../common/decorators/idempotent-write.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RecordsService } from './records.service.js';
import { VaccinationStatusService } from './vaccination-status.service.js';

@ApiTags('records')
@ApiBearerAuth()
@ApiParam({ name: 'petId', description: 'Pet id (UUID)' })
@Roles('owner', 'clinic')
@Controller({ path: 'pets/:petId', version: '1' })
export class RecordsController {
  constructor(
    private readonly records: RecordsService,
    private readonly status: VaccinationStatusService,
  ) {}

  @Get('record')
  @LogAccess('view_record', { dedupe: true })
  @ApiOperation({
    summary: 'Paginated record; 50 entries per section by default, at most 100',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Entries per section (1–100, default 50)',
  })
  @ApiQuery({
    name: 'section',
    required: false,
    enum: recordSectionSchema.options,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Next cursor for the selected section',
  })
  @ZodResponse('MedicalRecord', medicalRecordSchema)
  @ErrorResponses(401, 403, 404)
  get(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query(new ZodValidationPipe(recordQuerySchema)) query: RecordQuery,
  ): Promise<MedicalRecord> {
    return this.records.get(user, petId, query);
  }
  @Get('vaccination-status')
  @LogAccess('view_vaccination', { dedupe: true })
  @ApiOperation({
    summary: 'Vaccination schedule status by country, species and age',
  })
  @ZodResponse('VaccinationStatus', vaccinationStatusSchema)
  @ErrorResponses(401, 403, 404)
  vaccinationStatus(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<VaccinationStatus> {
    return this.status.vaccinationStatus(user, petId);
  }
  @Roles('clinic')
  @Post('consultations')
  @LogAccess('record_consultation')
  @ApiOperation({
    summary: 'Record a consultation (clinic with an active permission)',
  })
  @ZodBody('CreateConsultation', createConsultationSchema)
  @ZodResponse('Consultation', consultationSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  @IdempotentWrite()
  recordConsultation(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createConsultationSchema))
    data: CreateConsultation,
    @IdempotencyKey() key?: string,
  ): Promise<Consultation> {
    return this.records.recordConsultation(user, petId, data, key);
  }
  @Roles('clinic')
  @Post('vaccinations')
  @LogAccess('record_vaccination')
  @ApiOperation({
    summary: 'Record a vaccination; the expiry is computed from the schedule',
  })
  @ZodBody('CreateVaccination', createVaccinationSchema)
  @ZodResponse('Vaccination', vaccinationSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  @IdempotentWrite()
  recordVaccination(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createVaccinationSchema))
    data: CreateVaccination,
    @IdempotencyKey() key?: string,
  ): Promise<Vaccination> {
    return this.records.recordVaccination(user, petId, data, key);
  }
  @Roles('clinic')
  @Post('dewormings')
  @LogAccess('record_deworming')
  @ApiOperation({ summary: 'Record a deworming' })
  @ZodBody('CreateDeworming', createDewormingSchema)
  @ZodResponse('Deworming', dewormingSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  @IdempotentWrite()
  recordDeworming(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createDewormingSchema)) data: CreateDeworming,
    @IdempotencyKey() key?: string,
  ): Promise<Deworming> {
    return this.records.recordDeworming(user, petId, data, key);
  }
  @Roles('clinic')
  @Post('treatments')
  @LogAccess('record_treatment')
  @ApiOperation({ summary: 'Record a treatment' })
  @ZodBody('CreateTreatment', createTreatmentSchema)
  @ZodResponse('Treatment', treatmentSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  @IdempotentWrite()
  recordTreatment(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createTreatmentSchema)) data: CreateTreatment,
    @IdempotencyKey() key?: string,
  ): Promise<Treatment> {
    return this.records.recordTreatment(user, petId, data, key);
  }
  @Roles('clinic')
  @Post('exams')
  @LogAccess('record_exam')
  @ApiOperation({ summary: 'Record an exam' })
  @ZodBody('CreateExam', createExamSchema)
  @ZodResponse('Exam', examSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  @IdempotentWrite()
  recordExam(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createExamSchema)) data: CreateExam,
    @IdempotencyKey() key?: string,
  ): Promise<Exam> {
    return this.records.recordExam(user, petId, data, key);
  }
  @Roles('owner')
  @Post('weights')
  @LogAccess('record_weight')
  @ApiOperation({ summary: 'Record a weight (owner)' })
  @ZodBody('CreateWeightEntry', createWeightEntrySchema)
  @ZodResponse('WeightEntry', weightEntrySchema, { status: 201 })
  @ErrorResponses(400, 401, 403, 404)
  @IdempotentWrite()
  recordWeight(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createWeightEntrySchema))
    data: CreateWeightEntry,
    @IdempotencyKey() key?: string,
  ): Promise<WeightEntry> {
    return this.records.recordWeight(user, petId, data, key);
  }
  @Roles('owner')
  @Post('feedings')
  @LogAccess('record_feeding')
  @ApiOperation({ summary: 'Record feeding or an observation (owner)' })
  @ZodBody('CreateFeedingEntry', createFeedingEntrySchema)
  @ZodResponse('FeedingEntry', feedingEntrySchema, { status: 201 })
  @ErrorResponses(400, 401, 403, 404)
  @IdempotentWrite()
  recordFeeding(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createFeedingEntrySchema))
    data: CreateFeedingEntry,
    @IdempotencyKey() key?: string,
  ): Promise<FeedingEntry> {
    return this.records.recordFeeding(user, petId, data, key);
  }
}
