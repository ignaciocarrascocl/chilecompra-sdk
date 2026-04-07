# mercadopublico-chile 🇨🇱

SDK no oficial, fuertemente tipado para **Node.js** y **TypeScript**, para consumir la API de compras públicas del Estado de Chile ([Mercado Público](https://api.mercadopublico.cl/)).

Facilita la consulta de **licitaciones**, **órdenes de compra**, **compradores** y **proveedores**, con manejo automático de fechas, tipado completo de respuestas, reintentos con backoff exponencial, timeouts configurables y control de límite de peticiones diarias.

---

## 🚀 Instalación

```bash
npm install mercadopublico-chile
```

Requiere **Node.js 18 o superior** (fetch nativo). Para Node.js 14–17 pasa tu propia implementación de fetch — ver [Compatibilidad](#-compatibilidad).

---

## 💻 Uso Rápido

Para usar esta librería necesitas un **Ticket** (clave API). Puedes solicitarlo gratuitamente con tu Clave Única en la plataforma oficial de [Mercado Público](https://api.mercadopublico.cl/).

```typescript
import { MercadoPublicoClient } from 'mercadopublico-chile';

const client = new MercadoPublicoClient({
  ticket: 'TU_TICKET_AQUI',
});

async function consultarDatos() {
  try {
    // Licitaciones publicadas hoy
    const licitaciones = await client.getLicitacionesHoy();
    console.log(`${licitaciones.Cantidad} licitaciones hoy.`);

    // Detalle de una Orden de Compra específica
    const oc = await client.getOrdenCompra('2097-241-SE14');
    console.log('OC:', oc.Listado[0].Nombre);

  } catch (error) {
    console.error(error.message);
  } finally {
    // Libera recursos internos (timer del rate limiter)
    client.destroy();
  }
}

consultarDatos();
```

---

## ⚙️ Opciones de Configuración

Todas las opciones se pasan al constructor como un objeto `MPOptions`.

```typescript
const client = new MercadoPublicoClient({
  ticket: 'TU_TICKET_AQUI',

  // Tiempo máximo de espera por petición en ms (default: 10 000)
  timeoutMs: 8000,

  // Reintentos automáticos ante errores de red
  retry: {
    maxRetries:    3,   // reintentos máximos (default: 3)
    baseDelayMs:   300, // espera base en ms (default: 300)
    backoffFactor: 2,   // multiplicador entre reintentos (default: 2)
  },

  // Control del límite diario de peticiones (local por proceso)
  rateLimit: {
    enabled:           true,
    dailyLimit:        10000, // límite diario (default: 10 000)
    minTime:           0,     // ms mínimos entre peticiones (default: 0)
    warningThreshold:  9000,  // imprime advertencia al llegar aquí (default: 90%)
  },
});
```

> **Nota sobre reintentos:** el backoff exponencial sólo aplica a errores de red. Los errores HTTP 4xx, de rate limit y de timeout no se reintentan — fallan de inmediato.

---

## 📚 Métodos Disponibles

Todos los métodos retornan `Promise<RespuestaAPI<T>>` y están completamente tipados.

### Licitaciones

| Método | Descripción |
|---|---|
| `getLicitacionesHoy(filtros?)` | Licitaciones publicadas hoy. |
| `getLicitacionPorCodigo(codigo)` | Detalle de una licitación. Ej: `'1509-5-L114'`. |
| `getLicitacionesPorFecha(fecha, filtros?)` | Licitaciones de un día específico. El SDK convierte el `Date` al formato `ddmmaaaa`. |

Los `filtros` opcionales aceptan `{ estado?, CodigoOrganismo?, CodigoProveedor? }`.

```typescript
import { EstadoLicitacion } from 'mercadopublico-chile';

// Filtrar por estado y organismo
const resultado = await client.getLicitacionesPorFecha(new Date('2024-03-15'), {
  estado:          EstadoLicitacion.Adjudicada,
  CodigoOrganismo: 'MU001',
});
```

### Órdenes de Compra

| Método | Descripción |
|---|---|
| `getOrdenesCompraHoy(filtros?)` | Órdenes de compra emitidas hoy. |
| `getOrdenCompra(codigo)` | Detalle de una OC. Ej: `'2097-241-SE14'`. |
| `getOrdenesCompraPorFecha(fecha, filtros?)` | OC emitidas en un día específico. |

### Empresas

| Método | Descripción |
|---|---|
| `buscarProveedor(rut)` | Busca un proveedor por RUT. Ej: `'76354771k'`. |
| `listarCompradores()` | Listado completo de organismos compradores y sus códigos internos. |

### Utilidades del cliente

```typescript
// Peticiones disponibles restantes en el día (estimado local)
console.log(client.remainingDailyRequests);

// Liberar recursos al terminar
client.destroy();
```

---

## 🛡️ Manejo de Errores

El SDK exporta una jerarquía de errores tipados que permite distinguir la causa del fallo sin parsear strings.

```typescript
import {
  MercadoPublicoError,
  MercadoPublicoAPIError,
  MercadoPublicoRateLimitError,
  MercadoPublicoTimeoutError,
} from 'mercadopublico-chile';

try {
  await client.getLicitacionesHoy();
} catch (err) {
  if (err instanceof MercadoPublicoRateLimitError) {
    console.error(`Límite diario alcanzado: ${err.dailyLimit} peticiones.`);

  } else if (err instanceof MercadoPublicoTimeoutError) {
    console.error(`Timeout de ${err.timeoutMs}ms en: ${err.url}`);

  } else if (err instanceof MercadoPublicoAPIError) {
    console.error(`HTTP ${err.statusCode} – ${err.statusText}`);
    console.error(`URL: ${err.url}`);

  } else if (err instanceof MercadoPublicoError) {
    // Error de configuración u otro error del SDK
    console.error(err.message);
  }
}
```

| Clase | Cuándo se lanza | Propiedades adicionales |
|---|---|---|
| `MercadoPublicoError` | Base de todos los errores del SDK. Errores de configuración. | — |
| `MercadoPublicoAPIError` | La API retornó un código HTTP de error. | `statusCode`, `statusText`, `url` |
| `MercadoPublicoRateLimitError` | Se agotó el límite diario local. | `dailyLimit` |
| `MercadoPublicoTimeoutError` | La petición superó `timeoutMs`. | `timeoutMs`, `url` |

---

## 🔌 Compatibilidad

Este SDK usa `fetch` nativo, disponible en Node.js 18+ y en todos los edge runtimes y browsers modernos.

Para **Node.js 14–17**, pasa tu propia implementación:

```bash
npm install undici  # o node-fetch
```

```typescript
import { fetch } from 'undici';

const client = new MercadoPublicoClient({
  ticket: 'TU_TICKET_AQUI',
  fetch:  fetch as unknown as typeof globalThis.fetch,
});
```

---

## 📖 Referencia de Datos (Diccionarios de la API)

### Estados de Licitación

| Código | Estado | Enum |
|---|---|---|
| 5 | Publicada | `EstadoLicitacion.Publicada` |
| 6 | Cerrada | `EstadoLicitacion.Cerrada` |
| 7 | Desierta | `EstadoLicitacion.Desierta` |
| 8 | Adjudicada | `EstadoLicitacion.Adjudicada` |
| 18 | Revocada | `EstadoLicitacion.Revocada` |
| 19 | Suspendida | `EstadoLicitacion.Suspendida` |

### Tipos de Licitación

| Sigla | Descripción |
|---|---|
| L1 | Licitación Pública Menor a 100 UTM |
| LE | Licitación Pública Entre 100 y 1.000 UTM |
| LP | Licitación Pública Mayor a 1.000 UTM |
| LS | Licitación Pública de Servicios Personales Especializados |
| A1 | Licitación Privada por LP anterior sin oferentes |
| B1 | Licitación Privada por otras causales |
| C1 | Compra Directa (Orden de compra) |
| C2 | Trato Directo (Cotización) |
| D1 | Trato Directo por Proveedor Único |
| E1 | Licitación Privada por Remanente de Contrato anterior |
| F3 | Compra Directa (Orden de compra confidencial) |
| R1 | Orden de Compra menor a 3 UTM |
| CA | Orden de Compra sin Resolución |
| SE | Orden de Compra sin emisión automática de OC |

### Estados de Orden de Compra

| Código | Estado | Enum |
|---|---|---|
| 4 | Enviada a Proveedor | `EstadoOrdenCompra.EnviadaProveedor` |
| 6 | Aceptada | `EstadoOrdenCompra.Aceptada` |
| 9 | Cancelada | `EstadoOrdenCompra.Cancelada` |
| 12 | Recepción Conforme | `EstadoOrdenCompra.RecepcionConforme` |
| 13 | Pendiente de Recepcionar | `EstadoOrdenCompra.PendienteRecepcion` |
| 14 | Recepcionada Parcialmente | `EstadoOrdenCompra.RecepcionadaParcialmente` |
| 15 | Recepción Conforme Incompleta | `EstadoOrdenCompra.RecepcionConformeIncompleta` |

### Tipos de OC

| Código | Descripción |
|---|---|
| 1 (OC) | Automática |
| 9 (CM) | Convenio Marco |
| 12 (MC) | Microcompra |
| 13 (AG) | Compra Ágil |
| 14 (CC) | Compra Coordinada |

### Unidades Monetarias (`Moneda`)

| Valor | Descripción |
|---|---|
| `Moneda.CLP` | Peso Chileno |
| `Moneda.CLF` | Unidad de Fomento (UF) |
| `Moneda.USD` | Dólar Americano |
| `Moneda.UTM` | Unidad Tributaria Mensual |
| `Moneda.EUR` | Euro |

### Modalidades de Pago (Licitaciones)

| Valor | Descripción |
|---|---|
| 1 | Pago a 30 días |
| 2 | Pago a 30, 60 y 90 días |
| 3 | Pago al día |
| 4 | Pago Anual |
| 5 | Pago a 60 días |
| 6 | Pagos Mensuales |
| 7 | Pago Contra Entrega Conforme |
| 8 | Pago Bimensual |
| 9 | Pago Por Estado de Avance |
| 10 | Pago Trimestral |

### Tipos de Pago (Órdenes de Compra)

| Valor | Descripción |
|---|---|
| 1 | 15 días contra la recepción de la factura |
| 2 | 30 días contra la recepción de la factura |
| 39 | Otra forma de pago |
| 46 | 50 días contra la recepción de la factura |
| 47 | 60 días contra la recepción de la factura |
| 48 | A 45 días |
| 49 | A más de 30 días |

### Tipos de Despacho (Órdenes de Compra)

| Valor | Descripción |
|---|---|
| 7 | Despachar a dirección de envío |
| 9 | Despachar según programa adjuntado |
| 12 | Otra forma de despacho (ver instrucciones) |
| 14 | Retiramos de su bodega |
| 20 | Despacho por courier o encomienda aérea |
| 21 | Despacho por courier o encomienda terrestre |
| 22 | A convenir |

### Campos Binarios (Licitaciones)

Los siguientes campos del JSON devuelven `"1"` (Sí) o `"0"` (No). Usa `MercadoPublicoUtils.parseBoolean()` para convertirlos.

| Campo | Descripción |
|---|---|
| Licitación informada | Informa el tipo de licitación |
| Tipo de Licitación | `1` = Pública, `2` = Privada |
| Toma de Razón | Requiere toma de razón por la Contraloría |
| Visibilidad Ofertas Técnicas | Público tras apertura |
| Contrato | Requiere contrato |
| Obras | `2` = Obra Pública, `1` = No |
| Visibilidad del Monto | Visible en la ficha |
| Permite Subcontratación | Permite subcontratar |
| Extensión del Plazo | Se amplía automáticamente (Art. 25) |
| Es Base Tipo | Creada desde licitaciones tipo |
| Es Renovable | Contrato renovable |

---

## ⚠️ Términos y Condiciones de Uso Oficiales

Este es un paquete no oficial desarrollado por la comunidad. El uso de la API oficial de la Dirección ChileCompra está sujeto a las siguientes políticas:

1. **Límite diario:** Cada ticket tiene un límite de **10.000 solicitudes diarias**. Este SDK emite una advertencia en consola al llegar al 90% del límite (9.000 peticiones).
2. **Carga:** Para procesos de alta demanda, se recomienda ejecutarlos en **horario nocturno (22:00 a 07:00 hrs)**.
3. **Atribución:** Toda publicación de datos obtenidos desde la API debe indicar claramente que la fuente es la **Dirección ChileCompra**.

Para ver las políticas completas, visita [api.mercadopublico.cl](https://api.mercadopublico.cl/).

---

## Licencia

MIT