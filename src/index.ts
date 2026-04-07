/**
 * chilecompra-sdk
 * SDK robusto y tipado para la API de Mercado Público de Chile.
 * Documentación y comentarios en español (neutral LATAM).
 *
 * @version 2.0.0
 */

// `fetch` es nativo en Node 18+, browsers modernos y edge runtimes.
// Para entornos más antiguos, pasa tu propio fetch en `MPOptions.fetch`
// (ej: `node-fetch`, `cross-fetch`, o `undici`).
const globalFetch: typeof globalThis.fetch | undefined =
  typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : undefined;

// ==========================================
// 1. ERRORES TIPADOS
// ==========================================

export class MercadoPublicoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MercadoPublicoError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MercadoPublicoAPIError extends MercadoPublicoError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly statusText: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'MercadoPublicoAPIError';
  }
}

export class MercadoPublicoRateLimitError extends MercadoPublicoError {
  constructor(public readonly dailyLimit: number) {
    super(`[ChileCompra SDK] Límite diario alcanzado (${dailyLimit} peticiones).`);
    this.name = 'MercadoPublicoRateLimitError';
  }
}

export class MercadoPublicoTimeoutError extends MercadoPublicoError {
  constructor(public readonly timeoutMs: number, public readonly url: string) {
    super(`[ChileCompra SDK] Tiempo de espera agotado (${timeoutMs}ms): ${url}`);
    this.name = 'MercadoPublicoTimeoutError';
  }
}

// ==========================================
// 2. ENUMS Y CONSTANTES (Diccionarios de Datos)
// ==========================================

export enum EstadoLicitacion {
  Publicada    = 'publicada',
  Cerrada      = 'cerrada',
  Desierta     = 'desierta',
  Adjudicada   = 'adjudicada',
  Revocada     = 'revocada',
  Suspendida   = 'suspendida',
  Activas      = 'activas',
  Todos        = 'todos',
}

export enum EstadoOrdenCompra {
  EnviadaProveedor            = 'enviadaproveedor',
  Aceptada                    = 'aceptada',
  Cancelada                   = 'cancelada',
  RecepcionConforme            = 'recepcionconforme',
  PendienteRecepcion          = 'pendienterecepcion',
  RecepcionadaParcialmente    = 'recepcionaceptadacialmente', // valor exacto de la API
  RecepcionConformeIncompleta = 'recepecionconformeincompleta',
  Todos                       = 'todos',
}

export enum Moneda {
  CLP = 'CLP',
  CLF = 'CLF',
  USD = 'USD',
  UTM = 'UTM',
  EUR = 'EUR',
}

// ==========================================
// 3. INTERFACES DE RESPUESTA
// ==========================================

export type Formato = 'json' | 'xml' | 'jsonp';

export interface RespuestaAPI<T> {
  Cantidad:      number;
  FechaCreacion: string;
  Version:       string;
  Listado:       T[];
}

// ---------- Licitaciones ----------

export interface ItemLicitacion {
  CodigoExterno:       string;
  Nombre:              string;
  CodigoEstado:        string;
  Descripcion:         string;
  FechaCierre:         string;
  FechaPublicacion:    string;
  Organismo:           { Codigo: string; Nombre: string } | null;
  Tipo:                string;
  MontoEstimado:       string | null;
  Moneda:              string | null;
  [key: string]: unknown;
}

// ---------- Órdenes de Compra ----------

export interface ItemOrdenCompra {
  Codigo:              string;
  Nombre:              string;
  CodigoEstado:        string;
  FechaCreacion:       string;
  FechaEnvio:          string | null;
  Proveedor:           { CodigoProveedor: string; Nombre: string } | null;
  Organismo:           { Codigo: string; Nombre: string } | null;
  MontoTotal:          string | null;
  Moneda:              string | null;
  [key: string]: unknown;
}

// ---------- Empresas ----------

export interface ItemProveedor {
  Rut:         string;
  Nombre:      string;
  CodigoTipo:  string;
  [key: string]: unknown;
}

export interface ItemComprador {
  Codigo:      string;
  Nombre:      string;
  Sigla:       string | null;
  CodigoTipo:  string;
  [key: string]: unknown;
}

// ==========================================
// 4. INTERFACES DE OPCIONES
// ==========================================

export interface FiltrosBase {
  CodigoOrganismo?: string;
  CodigoProveedor?: string;
}

export interface FiltrosLicitacion extends FiltrosBase {
  estado?: EstadoLicitacion;
}

export interface FiltrosOrdenCompra extends FiltrosBase {
  estado?: EstadoOrdenCompra;
}

export interface RetryOptions {
  /** Número máximo de reintentos ante error de red (default: 3). */
  maxRetries?: number;
  /** Espera base en ms para backoff exponencial (default: 300). */
  baseDelayMs?: number;
  /** Multiplicador de backoff entre reintentos (default: 2). */
  backoffFactor?: number;
}

export interface RateLimitOptions {
  enabled?:          boolean;
  dailyLimit?:       number;
  /** Tiempo mínimo entre peticiones en ms (default: 0). */
  minTime?:          number;
  warningThreshold?: number;
  refreshIntervalMs?: number;
}

export interface MPOptions {
  /** Ticket de autorización provisto por Mercado Público. */
  ticket: string;
  /** Implementación de `fetch` a inyectar (útil en tests o entornos sin fetch global). */
  fetch?: typeof globalThis.fetch;
  /** Tiempo máximo de espera por petición en ms (default: 10 000). */
  timeoutMs?: number;
  /** Configuración de reintentos automáticos. */
  retry?: RetryOptions;
  /** Configuración del rate limiter local. */
  rateLimit?: RateLimitOptions;
}

// ==========================================
// 5. UTILIDADES
// ==========================================

export class MercadoPublicoUtils {
  /**
   * Convierte un `Date` al formato `ddmmaaaa` requerido por la API.
   */
  static formatDateToAPI(date: Date): string {
    const dd   = String(date.getDate()).padStart(2, '0');
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}${mm}${yyyy}`;
  }

  /**
   * Intenta convertir un valor a número. Retorna `null` si no es posible.
   */
  static toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(/[^0-9.-]+/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? null : n;
  }

  /**
   * Convierte `'1'`, `1`, `'true'` o `true` a `true`, todo lo demás a `false`.
   */
  static parseBoolean(value: string | number | boolean | undefined): boolean {
    return value === '1' || value === 1 || value === 'true' || value === true;
  }

  /**
   * Valida que un string no esté vacío o compuesto solo de espacios.
   * @throws {MercadoPublicoError}
   */
  static assertNonEmpty(value: string, fieldName: string): void {
    if (!value || value.trim() === '') {
      throw new MercadoPublicoError(`[ChileCompra SDK] El campo '${fieldName}' es obligatorio y no puede estar vacío.`);
    }
  }
}

// ==========================================
// 6. RATE LIMITER
// ==========================================

class RateLimiter {
  private readonly enabled:           boolean;
  private readonly dailyLimit:        number;
  private readonly minTime:           number;
  private readonly warningThreshold:  number;
  private readonly refreshIntervalMs: number;

  private remaining:       number;
  private lastRequestTime: number = 0;
  // NodeJS.Timeout expone .unref(); en browser es simplemente un número.
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts?: RateLimitOptions) {
    this.enabled           = opts?.enabled           ?? true;
    this.dailyLimit        = opts?.dailyLimit        ?? 10_000;
    this.remaining         = this.dailyLimit;
    this.minTime           = opts?.minTime           ?? 0;
    this.warningThreshold  = opts?.warningThreshold  ?? Math.floor(this.dailyLimit * 0.9);
    this.refreshIntervalMs = opts?.refreshIntervalMs ?? 24 * 60 * 60 * 1000;
    this.scheduleReset();
  }

  get remainingRequests(): number {
    return this.remaining;
  }

  private scheduleReset(): void {
    this.resetTimer = setTimeout(() => {
      this.remaining = this.dailyLimit;
      this.scheduleReset();
    }, this.refreshIntervalMs);

    // En Node.js, el timer expone .unref() para no bloquear el proceso al salir.
    // En browser/edge el timer es un número y no tiene este método.
    if (typeof this.resetTimer === 'object' && this.resetTimer !== null && typeof (this.resetTimer as { unref?: unknown }).unref === 'function') {
      (this.resetTimer as { unref(): void }).unref();
    }
  }

  /** Libera el timer interno. Llamar al destruir el cliente. */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    if (this.enabled) {
      if (this.remaining <= 0) {
        throw new MercadoPublicoRateLimitError(this.dailyLimit);
      }

      this.remaining--;
      const used = this.dailyLimit - this.remaining;
        if (used === this.warningThreshold) {
        console.warn(`[ChileCompra SDK] Advertencia: ${used}/${this.dailyLimit} peticiones utilizadas.`);
      }
    }

    const delay = Math.max(0, this.minTime - (Date.now() - this.lastRequestTime));
    if (delay > 0) await sleep(delay);

    this.lastRequestTime = Date.now();
    return fn();
  }
}

// ==========================================
// 7. HELPERS INTERNOS
// ==========================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envuelve una promesa con un timeout.
 * @throws {MercadoPublicoTimeoutError}
 */
function withTimeout<T>(promise: Promise<T>, ms: number, url: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new MercadoPublicoTimeoutError(ms, url)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

/**
 * Ejecuta `fn` con reintentos y backoff exponencial.
 * Solo reintenta en errores de red, nunca en errores HTTP 4xx.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Required<RetryOptions>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // No reintentar errores de dominio (rate limit, timeout, API 4xx)
      if (
        err instanceof MercadoPublicoRateLimitError ||
        err instanceof MercadoPublicoTimeoutError   ||
        (err instanceof MercadoPublicoAPIError && err.statusCode >= 400 && err.statusCode < 500)
      ) {
        throw err;
      }

      lastError = err;
      if (attempt < opts.maxRetries) {
        const delay = opts.baseDelayMs * Math.pow(opts.backoffFactor, attempt);
        console.warn(`[ChileCompra SDK] Reintento ${attempt + 1}/${opts.maxRetries} en ${delay}ms…`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ==========================================
// 8. CLIENTE PRINCIPAL
// ==========================================

export class MercadoPublicoClient {
  private readonly ticket:    string;
  private readonly baseUrl  = 'https://api.mercadopublico.cl/servicios/v1/publico';
  private readonly fetchImpl!: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly retryOpts: Required<RetryOptions>;
  private readonly limiter:   RateLimiter;

  constructor(options: MPOptions) {
    if (!options.ticket || options.ticket.trim() === '') {
      throw new MercadoPublicoError('[ChileCompra SDK] El ticket de autorización es obligatorio.');
    }

    this.ticket    = options.ticket.trim();
    const resolvedFetch = options.fetch ?? globalFetch;
    if (!resolvedFetch) {
      throw new MercadoPublicoError(
        '[ChileCompra SDK] No se encontró `fetch` en el entorno. ' +
        'Actualiza a Node 18+ o pasa una implementación en MPOptions.fetch (ej: node-fetch, undici).',
      );
    }
    this.fetchImpl  = resolvedFetch;
    this.timeoutMs  = options.timeoutMs ?? 10_000;
    this.limiter    = new RateLimiter(options.rateLimit);
    this.retryOpts  = {
      maxRetries:    options.retry?.maxRetries    ?? 3,
      baseDelayMs:   options.retry?.baseDelayMs   ?? 300,
      backoffFactor: options.retry?.backoffFactor ?? 2,
    };
  }

  /** Cuántas peticiones quedan disponibles en el día (estimado local). */
  get remainingDailyRequests(): number {
    return this.limiter.remainingRequests;
  }

  /**
   * Libera recursos internos (timer del rate limiter).
   * Llamar cuando el cliente ya no se necesite.
   */
  destroy(): void {
    this.limiter.destroy();
  }

  // ----------------------------------------
  // Motor de peticiones
  // ----------------------------------------

  private buildUrl(endpoint: string, params: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}/${endpoint}.json`);
    url.searchParams.set('ticket', this.ticket);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async request<T>(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);

    const execute = (): Promise<T> =>
      this.limiter.schedule(async () => {
        const response = await withTimeout(
          this.fetchImpl(url),
          this.timeoutMs,
          url,
        );

        if (!response.ok) {
          throw new MercadoPublicoAPIError(
            `[ChileCompra SDK] Error HTTP ${response.status} al consultar: ${url}`,
            response.status,
            response.statusText,
            url,
          );
        }

        const data = await response.json() as Record<string, unknown>;

        if (typeof data['Mensaje'] === 'string') {
          throw new MercadoPublicoAPIError(data['Mensaje'] as string, 200, 'API Error', url);
        }

        return data as T;
      });

    return withRetry(execute, this.retryOpts);
  }

  // ----------------------------------------
  // Licitaciones
  // ----------------------------------------

  /**
   * Retorna las licitaciones publicadas hoy.
   */
  getLicitacionesHoy(
    filtros?: FiltrosLicitacion,
  ): Promise<RespuestaAPI<ItemLicitacion>> {
    return this.request<RespuestaAPI<ItemLicitacion>>(
      'licitaciones',
      this.serializeFiltros(filtros),
    );
  }

  /**
   * Retorna el detalle de una licitación por su código único.
   * @param codigo  Código de la licitación (ej: `"1234-56-LE20"`).
   */
  getLicitacionPorCodigo(
    codigo: string,
  ): Promise<RespuestaAPI<ItemLicitacion>> {
    MercadoPublicoUtils.assertNonEmpty(codigo, 'codigo');
    return this.request<RespuestaAPI<ItemLicitacion>>('licitaciones', { codigo });
  }

  /**
   * Retorna las licitaciones publicadas en una fecha determinada.
   */
  getLicitacionesPorFecha(
    fecha: Date,
    filtros?: FiltrosLicitacion,
  ): Promise<RespuestaAPI<ItemLicitacion>> {
    return this.request<RespuestaAPI<ItemLicitacion>>('licitaciones', {
      fecha: MercadoPublicoUtils.formatDateToAPI(fecha),
      ...this.serializeFiltros(filtros),
    });
  }

  // ----------------------------------------
  // Órdenes de Compra
  // ----------------------------------------

  /**
   * Retorna las órdenes de compra emitidas hoy.
   */
  getOrdenesCompraHoy(
    filtros?: FiltrosOrdenCompra,
  ): Promise<RespuestaAPI<ItemOrdenCompra>> {
    return this.request<RespuestaAPI<ItemOrdenCompra>>('ordenesdecompra', {
      estado: EstadoOrdenCompra.Todos,
      ...this.serializeFiltros(filtros),
    });
  }

  /**
   * Retorna el detalle de una orden de compra por su código.
   */
  getOrdenCompra(
    codigo: string,
  ): Promise<RespuestaAPI<ItemOrdenCompra>> {
    MercadoPublicoUtils.assertNonEmpty(codigo, 'codigo');
    return this.request<RespuestaAPI<ItemOrdenCompra>>('ordenesdecompra', { codigo });
  }

  /**
   * Retorna las órdenes de compra emitidas en una fecha determinada.
   */
  getOrdenesCompraPorFecha(
    fecha: Date,
    filtros?: FiltrosOrdenCompra,
  ): Promise<RespuestaAPI<ItemOrdenCompra>> {
    return this.request<RespuestaAPI<ItemOrdenCompra>>('ordenesdecompra', {
      fecha: MercadoPublicoUtils.formatDateToAPI(fecha),
      ...this.serializeFiltros(filtros),
    });
  }

  // ----------------------------------------
  // Empresas (Proveedores / Compradores)
  // ----------------------------------------

  /**
   * Busca un proveedor registrado en el sistema por su RUT.
   * @param rut  RUT sin puntos ni guión (ej: `"76354771k"`).
   */
  buscarProveedor(rut: string): Promise<RespuestaAPI<ItemProveedor>> {
    MercadoPublicoUtils.assertNonEmpty(rut, 'rut');
    return this.request<RespuestaAPI<ItemProveedor>>(
      'Empresas/BuscarProveedor',
      { rutempresaproveedor: rut.trim() },
    );
  }

  /**
   * Retorna el listado completo de organismos compradores registrados.
   */
  listarCompradores(): Promise<RespuestaAPI<ItemComprador>> {
    return this.request<RespuestaAPI<ItemComprador>>('Empresas/BuscarComprador');
  }

  // ----------------------------------------
  // Helpers privados
  // ----------------------------------------

  private serializeFiltros(
    filtros?: FiltrosBase & { estado?: string },
  ): Record<string, string> {
    if (!filtros) return {};
    const out: Record<string, string> = {};
    if (filtros.estado)           out['estado']           = filtros.estado;
    if (filtros.CodigoOrganismo)  out['CodigoOrganismo']  = filtros.CodigoOrganismo;
    if (filtros.CodigoProveedor)  out['CodigoProveedor']  = filtros.CodigoProveedor;
    return out;
  }
}

export default MercadoPublicoClient;