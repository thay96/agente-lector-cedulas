'use strict';

const { SerialPort } = require('serialport');
const { io } = require('socket.io-client');

// ── Configuración ──────────────────────────────────────────
const SERVIDOR_URL = 'http://192.168.11.84:3000';
const PUERTO_COM = 'COM3';
const BAUD_RATE = 115200;

const MARKER = Buffer.from('PubDSK'); // Punto de referencia fijo dentro de la trama
// Offset del marcador dentro de la trama, medido empíricamente con este lector.
// Si en el futuro las lecturas buenas fallan la validación, ajusta este número
// comparando la posición real del marcador contra el documento esperado.
const MARKER_OFFSET_IN_FRAME = 24;

const MAX_BUFFER_SIN_MARCADOR = 4000; // Si crece demasiado sin hallar el marcador, se descarta
const TIEMPO_LIMPIEZA_MS = 3000; // Si no llega nada nuevo en este tiempo, se limpia el buffer

// ── Conexión con el servidor central (Socket.IO) ────────────
const socket = io(SERVIDOR_URL);

socket.on('connect', () => console.log('✅ Conectado al servidor central:', SERVIDOR_URL));
socket.on('disconnect', () => console.log('⚠️  Desconectado del servidor. Intentando reconectar...'));
socket.on('connect_error', (err) => console.error('❌ No se pudo conectar al servidor:', err.message));

// ── Conexión con el lector (puerto serial) ──────────────────
const port = new SerialPort({ path: PUERTO_COM, baudRate: BAUD_RATE });
console.log(`🔌 Escuchando en ${PUERTO_COM}... Pasa la cédula.`);

let bufferAcumulado = Buffer.alloc(0);
let timerLimpieza = null;

function cleanField(buf) {
  return buf.toString('latin1').replace(/\0/g, '').trim();
}

function limpiarRuido(buffer) {
  const texto = buffer.toString('latin1');
  const textoLimpio = texto.replace(/\d{1,2}:\d{2}\s?[ap]\.\s?m\.\s?\d{2}\/\d{2}\/\d{4}/gi, '');
  return Buffer.from(textoLimpio, 'latin1');
}

function intentarExtraer(buffer) {
  const idxMarker = buffer.indexOf(MARKER);
  if (idxMarker === -1) return null;

  const inicioFrame = idxMarker - MARKER_OFFSET_IN_FRAME;
  if (inicioFrame < 0) return null;

  if (buffer.length < inicioFrame + 168) return null;

  const frame = buffer.subarray(inicioFrame);

  const documento = cleanField(frame.subarray(48, 58)).replace(/^0+/, '');
  const primerApellido = cleanField(frame.subarray(58, 81));
  const segundoApellido = cleanField(frame.subarray(81, 104));
  const nombres = cleanField(frame.subarray(104, 127));
  const segundoNombre = cleanField(frame.subarray(127, 150));
  const sexo = cleanField(frame.subarray(151, 152));
  const fechaNacimiento = cleanField(frame.subarray(152, 160));

  const nombreCompleto = `${primerApellido} ${segundoApellido} ${nombres} ${segundoNombre}`.replace(/\s+/g, ' ').trim();

  const documentoValido = /^\d{6,10}$/.test(documento);
  const nombreValido = /^[A-ZÑ\s]{3,80}$/.test(nombreCompleto);

  if (!documentoValido || !nombreValido) {
    return { valido: false, documento, nombreCompleto };
  }

  return {
    valido: true,
    documento,
    primerApellido,
    segundoApellido,
    nombres,
    segundoNombre,
    nombreCompleto,
    sexo,
    fechaNacimiento,
    bytesConsumidos: inicioFrame + 168,
  };
}

port.on('data', (chunk) => {
  bufferAcumulado = Buffer.concat([bufferAcumulado, chunk]);
  bufferAcumulado = limpiarRuido(bufferAcumulado);

  clearTimeout(timerLimpieza);
  timerLimpieza = setTimeout(() => {
    if (bufferAcumulado.length > 0) {
      console.log('🧹 Buffer limpiado por inactividad.');
      bufferAcumulado = Buffer.alloc(0);
    }
  }, TIEMPO_LIMPIEZA_MS);

  const resultado = intentarExtraer(bufferAcumulado);

  if (resultado === null) {
    if (bufferAcumulado.length > MAX_BUFFER_SIN_MARCADOR) {
      console.warn('⚠️  Buffer descartado: demasiados datos sin encontrar un marcador válido.');
      bufferAcumulado = Buffer.alloc(0);
    }
    return;
  }

  if (!resultado.valido) {
    console.warn('\n⚠️  Lectura descartada: los datos no tienen el formato esperado.');
    console.warn('   Documento leído:', JSON.stringify(resultado.documento));
    console.warn('   Nombre leído:   ', JSON.stringify(resultado.nombreCompleto));
    console.warn('   Por favor, vuelve a escanear la cédula.\n');

    bufferAcumulado = Buffer.alloc(0);
    return;
  }

  const datos = resultado;

  console.log('\n✅ ¡CÉDULA DECODIFICADA CON ÉXITO!');
  console.log('-----------------------------------');
  console.log('📌 Documento:        ', datos.documento);
  console.log('📌 Nombre completo:  ', datos.nombreCompleto);
  console.log('-----------------------------------\n');

  if (socket.connected) {
    socket.emit('cedula-escaneada', datos);
    console.log('📡 Datos enviados al servidor.\n');
  } else {
    console.warn('⚠️  No hay conexión con el servidor. Los datos NO se enviaron.\n');
  }

  bufferAcumulado = bufferAcumulado.subarray(datos.bytesConsumidos);
});

port.on('error', (err) => {
  console.error('❌ Error en puerto serie:', err.message);
});