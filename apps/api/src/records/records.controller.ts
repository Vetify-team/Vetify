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
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  ErrorResponses,
  ZodBody,
  ZodResponse,
} from '../common/openapi/zod-openapi.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RecordsService } from './records.service.js';

@ApiTags('records')
@ApiBearerAuth()
@ApiParam({ name: 'petId', description: 'Pet id (UUID)' })
@Roles('owner', 'clinic')
@Controller({ path: 'pets/:petId', version: '1' })
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

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
    return this.records.vaccinationStatus(user, petId);
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
  recordConsultation(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createConsultationSchema))
    data: CreateConsultation,
  ): Promise<Consultation> {
    return this.records.recordConsultation(user, petId, data);
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
  recordVaccination(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createVaccinationSchema))
    data: CreateVaccination,
  ): Promise<Vaccination> {
    return this.records.recordVaccination(user, petId, data);
  }
  @Roles('clinic')
  @Post('dewormings')
  @LogAccess('record_deworming')
  @ApiOperation({ summary: 'Record a deworming' })
  @ZodBody('CreateDeworming', createDewormingSchema)
  @ZodResponse('Deworming', dewormingSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  recordDeworming(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createDewormingSchema)) data: CreateDeworming,
  ): Promise<Deworming> {
    return this.records.recordDeworming(user, petId, data);
  }
  @Roles('clinic')
  @Post('treatments')
  @LogAccess('record_treatment')
  @ApiOperation({ summary: 'Record a treatment' })
  @ZodBody('CreateTreatment', createTreatmentSchema)
  @ZodResponse('Treatment', treatmentSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  recordTreatment(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createTreatmentSchema)) data: CreateTreatment,
  ): Promise<Treatment> {
    return this.records.recordTreatment(user, petId, data);
  }
  @Roles('clinic')
  @Post('exams')
  @LogAccess('record_exam')
  @ApiOperation({ summary: 'Record an exam' })
  @ZodBody('CreateExam', createExamSchema)
  @ZodResponse('Exam', examSchema, { status: 201 })
  @ErrorResponses(400, 401, 403)
  recordExam(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createExamSchema)) data: CreateExam,
  ): Promise<Exam> {
    return this.records.recordExam(user, petId, data);
  }
  @Roles('owner')
  @Post('weights')
  @LogAccess('record_weight')
  @ApiOperation({ summary: 'Record a weight (owner)' })
  @ZodBody('CreateWeightEntry', createWeightEntrySchema)
  @ZodResponse('WeightEntry', weightEntrySchema, { status: 201 })
  @ErrorResponses(400, 401, 403, 404)
  recordWeight(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createWeightEntrySchema))
    data: CreateWeightEntry,
  ): Promise<WeightEntry> {
    return this.records.recordWeight(user, petId, data);
  }
  @Roles('owner')
  @Post('feedings')
  @LogAccess('record_feeding')
  @ApiOperation({ summary: 'Record feeding or an observation (owner)' })
  @ZodBody('CreateFeedingEntry', createFeedingEntrySchema)
  @ZodResponse('FeedingEntry', feedingEntrySchema, { status: 201 })
  @ErrorResponses(400, 401, 403, 404)
  recordFeeding(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createFeedingEntrySchema))
    data: CreateFeedingEntry,
  ): Promise<FeedingEntry> {
    return this.records.recordFeeding(user, petId, data);
  }
}
