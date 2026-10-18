// TutoMatch UPTC - Backend (Node.js + Express + PostgreSQL)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Copia .env.example a .env y complétalo.');
  process.exit(1);
}

// Supabase exige SSL; localhost normalmente no.
const usaSSL = !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: usaSSL ? { rejectUnauthorized: false } : false,
});

// ---------- Middlewares ----------
// CORS: solo orígenes permitidos (GitHub Pages + local). Lista separada por comas en .env
const origenes = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origenes.length === 0 || origenes.includes(origin)) return cb(null, true);
      return cb(new Error('Origen no permitido por CORS'));
    },
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend'))); // sirve el frontend en local

// ---------- Validación ----------
const RE_EMAIL = /^[A-Za-z0-9._%+-]+@uptc\.edu\.co$/i;
const RE_CODIGO = /^\d{9}$/;

function validar(body) {
  const errores = [];
  const nombre = String(body.nombre ?? '').trim();
  const email = String(body.email_corp ?? '').trim().toLowerCase();
  const codigo = String(body.codigo_est ?? '').trim();
  const materiaId = Number(body.materia_id);

  if (!nombre) errores.push('El nombre es obligatorio.');
  else if (nombre.length < 3 || nombre.length > 120) errores.push('El nombre debe tener entre 3 y 120 caracteres.');

  if (!email) errores.push('El correo institucional es obligatorio.');
  else if (!RE_EMAIL.test(email)) errores.push('Usa tu correo institucional (@uptc.edu.co).');

  if (!codigo) errores.push('El código estudiantil es obligatorio.');
  else if (!RE_CODIGO.test(codigo)) errores.push('El código estudiantil debe tener exactamente 9 dígitos.');

  if (!body.materia_id) errores.push('Selecciona una materia.');
  else if (!Number.isInteger(materiaId) || materiaId <= 0) errores.push('Materia inválida.');

  return { errores, datos: { nombre, email, codigo, materiaId } };
}

// ---------- Rutas ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Lista de materias para llenar el <select> del frontend
app.get('/api/materias', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre FROM materias ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar las materias.' });
  }
});

// Registrar solicitud de tutoría
app.post('/api/tutorias', async (req, res) => {
  try {
    const { errores, datos } = validar(req.body || {});
    if (errores.length) {
      return res.status(400).json({ ok: false, mensaje: 'Datos inválidos.', errores });
    }

    // 1) La materia debe existir
    const materia = await pool.query('SELECT id FROM materias WHERE id = $1', [datos.materiaId]);
    if (materia.rowCount === 0) {
      return res.status(400).json({ ok: false, mensaje: 'La materia seleccionada no existe.' });
    }

    // 2) Prevenir duplicados por código estudiantil
    const dup = await pool.query('SELECT 1 FROM solicitudes_tutoria WHERE codigo_est = $1', [datos.codigo]);
    if (dup.rowCount > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una solicitud con ese código estudiantil.' });
    }

    // 3) Insertar (consulta parametrizada => evita SQL injection)
    const { rows } = await pool.query(
      `INSERT INTO solicitudes_tutoria (nombre, email_corp, codigo_est, materia_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email_corp, codigo_est, materia_id, fecha_registro`,
      [datos.nombre, datos.email, datos.codigo, datos.materiaId]
    );

    res.status(201).json({ ok: true, mensaje: 'Solicitud registrada correctamente.', solicitud: rows[0] });
  } catch (err) {
    // 23505 = unique_violation (carrera entre dos peticiones simultáneas)
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una solicitud con ese código estudiantil.' });
    }
    console.error('Error en POST /api/tutorias:', err);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
  }
});

// Listado para docentes coordinadores
app.get('/api/tutorias', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.nombre, s.email_corp, s.codigo_est, m.nombre AS materia, s.fecha_registro
       FROM solicitudes_tutoria s JOIN materias m ON m.id = s.materia_id
       ORDER BY s.fecha_registro DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
  }
});

// Errores de CORS u otros no controlados
app.use((err, _req, res, _next) => {
  res.status(err.message?.includes('CORS') ? 403 : 500).json({ ok: false, mensaje: err.message });
});

app.listen(PORT, () => console.log(`TutoMatch API escuchando en http://localhost:${PORT}`));
