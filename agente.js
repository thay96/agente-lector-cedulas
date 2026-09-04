'use strict';

const { SerialPort } = require('serialport');
const { io } = require('socket.io-client');

// ── Configuración ──────────────────────────────────────────
const SERVIDOR_URL = 'http://localhost:3000';
const PUERTO_COM   = 'COM3';
const BAUD_RATE    = 9600;

// ── Conexión con el servidor central (Socket.IO) ────────────
const socket = io(SERVIDOR_URL);

socket.on('connect', () => {
  console.log('✅ Conectado al servidor central:', SERVIDOR_URL);
});

socket.on('disconnect', () => {
  console.log('⚠️  Desconectado del servidor. Intentando reconectar...');
});

socket.on('connect_error', (err) => {
  console.error('❌ No se pudo conectar al servidor:', err.message);
});

// ── Conexión con el lector (puerto serial) ──────────────────
const port = new SerialPort({
  path: PUERTO_COM,
  baudRate: BAUD_RATE,
});

console.log(`🔌 Escuchando en ${PUERTO_COM}... Pasa la cédula.`);

let bufferAcumulado = Buffer.alloc(0);

port.on('data', (chunk) => {
  bufferAcumulado = Buffer.concat([bufferAcumulado, chunk]);

  if (bufferAcumulado.length >= 200) {
    const raw = bufferAcumulado;

    const documento        = raw.subarray(48, 58).toString('latin1').replace(/\0/g, '').trim();
    const primerApellido   = raw.subarray(58, 81).toString('latin1').replace(/\0/g, '').trim();
    const segundoApellido  = raw.subarray(81, 104).toString('latin1').replace(/\0/g, '').trim();
    const nombres          = raw.subarray(104, 127).toString('latin1').replace(/\0/g, '').trim();
    const sexo             = raw.subarray(151, 152).toString('latin1').trim();
    const fechaNacimiento  = raw.subarray(152, 160).toString('latin1').trim();

    const nombreCompleto = `${primerApellido} ${segundoApellido} ${nombres}`.replace(/\s+/g, ' ').trim();

    const datos = {
      documento,
      primerApellido,
      segundoApellido,
      nombres,
      nombreCompleto,
      sexo,
      fechaNacimiento,
    };

    console.log('\n✅ ¡CÉDULA DECODIFICADA CON ÉXITO!');
    console.log('-----------------------------------');
    console.log('📌 Documento:        ', datos.documento);
    console.log('📌 Nombre completo:  ', datos.nombreCompleto);
    console.log('-----------------------------------\n');

    // Enviar al servidor central
    if (socket.connected) {
      socket.emit('cedula-escaneada', datos);
      console.log('📡 Datos enviados al servidor.\n');
    } else {
      console.warn('⚠️  No hay conexión con el servidor. Los datos NO se enviaron.\n');
    }

    // Limpiar el buffer para la siguiente lectura
    bufferAcumulado = Buffer.alloc(0);
  }
});

port.on('error', (err) => {
  console.error('❌ Error en puerto serie:', err.message);
});