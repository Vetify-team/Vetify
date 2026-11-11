import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  createUploadSchema,
  fileLinkSchema,
  uploadTicketSchema,
  type CreateUpload,
  type FileLink,
  type TokenPayload,
  type UploadTicket,
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
import { FilesService } from './files.service.js';

@ApiTags('files')
@ApiBearerAuth()
@ApiParam({ name: 'petId', description: 'Pet id (UUID)' })
@Roles('owner', 'clinic')
@Controller({ path: 'pets/:petId', version: '1' })
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('uploads')
  @LogAccess('request_upload')
  @ApiOperation({
    summary: 'Sign one direct upload to the storage service',
    description:
      "pet_photo: the owner. exam_file: the owner or a clinic with an active permission. The answer is a one-hour signature for a single new file under this pet, limited to the purpose's formats; the size is checked again before a record keeps the file. Send `fileId` back when saving the photo or the exam.",
  })
  @ZodBody('CreateUpload', createUploadSchema)
  @ZodResponse('UploadTicket', uploadTicketSchema, { status: 201 })
  @ErrorResponses(400, 401, 403, 404, 503)
  createUpload(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body(new ZodValidationPipe(createUploadSchema)) data: CreateUpload,
  ): Promise<UploadTicket> {
    return this.files.createUpload(user, petId, data);
  }

  @Get('exams/:examId/file')
  @LogAccess('view_exam_file')
  @ApiOperation({
    summary: "Link to an exam's uploaded file, valid for five minutes",
  })
  @ApiParam({ name: 'examId', description: 'Exam id (UUID)' })
  @ZodResponse('FileLink', fileLinkSchema)
  @ErrorResponses(401, 403, 404, 503)
  examFile(
    @CurrentUser() user: TokenPayload,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
  ): Promise<FileLink> {
    return this.files.examFileLink(user, petId, examId);
  }
}
