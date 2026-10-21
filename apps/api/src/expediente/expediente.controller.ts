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
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import {
  consultaSchema,
  desparasitacionSchema,
  estadoVacunacionSchema,
  examenSchema,
  expedienteSchema,
  registroAlimentacionSchema,
  registroPesoSchema,
  tratamientoSchema,
  vacunaSchema,
  crearConsultaSchema,
  crearDesparasitacionSchema,
  crearExamenSchema,
  crearRegistroAlimentacionSchema,
  crearRegistroPesoSchema,
  crearTratamientoSchema,
  crearVacunaSchema,
  type Consulta,
  type CrearConsulta,
  type CrearDesparasitacion,
  type CrearExamen,
  type CrearRegistroAlimentacion,
  type CrearRegistroPeso,
  type CrearTratamiento,
  type CrearVacuna,
  type Desparasitacion,
  type EstadoVacunacion,
  type Examen,
  type Expediente,
  type RegistroAlimentacion,
  type RegistroPeso,
  type TokenPayload,
  type Tratamiento,
  type Vacuna,
} from '@vetify/types';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Cuerpo, Errores, Respuesta } from '../common/openapi/zod-openapi.js';
import { AccionBitacora } from '../common/interceptors/bitacora.interceptor.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ExpedienteService } from './expediente.service.js';

@ApiTags('expediente')
@ApiBearerAuth()
@ApiParam({ name: 'mascotaId', description: 'Id de la mascota (UUID)' })
@Controller('mascotas/:mascotaId')
export class ExpedienteController {
  constructor(private readonly expedienteService: ExpedienteService) {}

  @Get('expediente')
  @AccionBitacora('ver_expediente')
  @ApiOperation({
    summary: 'Expediente consolidado, sin importar qué clínica lo alimentó',
  })
  @Respuesta('Expediente', expedienteSchema)
  @Errores(401, 403, 404)
  obtener(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
  ): Promise<Expediente> {
    return this.expedienteService.obtener(usuario, mascotaId);
  }

  @Get('vacunacion')
  @AccionBitacora('ver_vacunacion')
  @ApiOperation({
    summary: 'Estado del esquema de vacunación según país, especie y edad',
  })
  @Respuesta('EstadoVacunacion', estadoVacunacionSchema)
  @Errores(401, 403, 404)
  vacunacion(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
  ): Promise<EstadoVacunacion> {
    return this.expedienteService.estadoVacunacion(usuario, mascotaId);
  }

  // ---------- Acto médico ----------

  @Roles('clinica')
  @Post('consultas')
  @AccionBitacora('registrar_consulta')
  @ApiOperation({
    summary: 'Registrar una consulta (clínica con permiso activo)',
  })
  @Cuerpo('CrearConsulta', crearConsultaSchema)
  @Respuesta('Consulta', consultaSchema, { estado: 201 })
  @Errores(400, 401, 403)
  registrarConsulta(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(crearConsultaSchema)) datos: CrearConsulta,
  ): Promise<Consulta> {
    return this.expedienteService.registrarConsulta(usuario, mascotaId, datos);
  }

  @Roles('clinica')
  @Post('vacunas')
  @AccionBitacora('registrar_vacuna')
  @ApiOperation({
    summary: 'Registrar una vacuna; el vencimiento se calcula con el esquema',
  })
  @Cuerpo('CrearVacuna', crearVacunaSchema)
  @Respuesta('Vacuna', vacunaSchema, { estado: 201 })
  @Errores(400, 401, 403)
  registrarVacuna(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(crearVacunaSchema)) datos: CrearVacuna,
  ): Promise<Vacuna> {
    return this.expedienteService.registrarVacuna(usuario, mascotaId, datos);
  }

  @Roles('clinica')
  @Post('desparasitaciones')
  @AccionBitacora('registrar_desparasitacion')
  @ApiOperation({ summary: 'Registrar una desparasitación' })
  @Cuerpo('CrearDesparasitacion', crearDesparasitacionSchema)
  @Respuesta('Desparasitacion', desparasitacionSchema, { estado: 201 })
  @Errores(400, 401, 403)
  registrarDesparasitacion(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(crearDesparasitacionSchema))
    datos: CrearDesparasitacion,
  ): Promise<Desparasitacion> {
    return this.expedienteService.registrarDesparasitacion(
      usuario,
      mascotaId,
      datos,
    );
  }

  @Roles('clinica')
  @Post('tratamientos')
  @AccionBitacora('registrar_tratamiento')
  @ApiOperation({ summary: 'Registrar un tratamiento' })
  @Cuerpo('CrearTratamiento', crearTratamientoSchema)
  @Respuesta('Tratamiento', tratamientoSchema, { estado: 201 })
  @Errores(400, 401, 403)
  registrarTratamiento(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(crearTratamientoSchema))
    datos: CrearTratamiento,
  ): Promise<Tratamiento> {
    return this.expedienteService.registrarTratamiento(
      usuario,
      mascotaId,
      datos,
    );
  }

  @Roles('clinica')
  @Post('examenes')
  @AccionBitacora('registrar_examen')
  @ApiOperation({ summary: 'Registrar un examen' })
  @Cuerpo('CrearExamen', crearExamenSchema)
  @Respuesta('Examen', examenSchema, { estado: 201 })
  @Errores(400, 401, 403)
  registrarExamen(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(crearExamenSchema)) datos: CrearExamen,
  ): Promise<Examen> {
    return this.expedienteService.registrarExamen(usuario, mascotaId, datos);
  }

  // ---------- Día a día ----------

  @Roles('dueño')
  @Post('peso')
  @AccionBitacora('registrar_peso')
  @ApiOperation({ summary: 'Registrar el peso (dueño)' })
  @Cuerpo('CrearRegistroPeso', crearRegistroPesoSchema)
  @Respuesta('RegistroPeso', registroPesoSchema, { estado: 201 })
  @Errores(400, 401, 403, 404)
  registrarPeso(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(crearRegistroPesoSchema))
    datos: CrearRegistroPeso,
  ): Promise<RegistroPeso> {
    return this.expedienteService.registrarPeso(usuario, mascotaId, datos);
  }

  @Roles('dueño')
  @Post('alimentacion')
  @AccionBitacora('registrar_alimentacion')
  @ApiOperation({ summary: 'Registrar alimentación u observaciones (dueño)' })
  @Cuerpo('CrearRegistroAlimentacion', crearRegistroAlimentacionSchema)
  @Respuesta('RegistroAlimentacion', registroAlimentacionSchema, {
    estado: 201,
  })
  @Errores(400, 401, 403, 404)
  registrarAlimentacion(
    @UsuarioActual() usuario: TokenPayload,
    @Param('mascotaId', ParseUUIDPipe) mascotaId: string,
    @Body(new ZodValidationPipe(crearRegistroAlimentacionSchema))
    datos: CrearRegistroAlimentacion,
  ): Promise<RegistroAlimentacion> {
    return this.expedienteService.registrarAlimentacion(
      usuario,
      mascotaId,
      datos,
    );
  }
}
