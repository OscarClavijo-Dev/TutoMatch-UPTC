-- =====================================================
-- TutoMatch UPTC - Esquema PostgreSQL (Caso 1)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- (o en psql / pgAdmin si usas PostgreSQL local)
-- =====================================================

-- Limpieza para poder re-ejecutar el script sin errores
DROP TABLE IF EXISTS solicitudes_tutoria;
DROP TABLE IF EXISTS materias;

-- Catálogo de materias (materia_id es llave foránea de solicitudes_tutoria)
CREATE TABLE materias (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL UNIQUE
);

-- Tabla principal pedida por la guía
CREATE TABLE solicitudes_tutoria (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(120) NOT NULL,
    email_corp     VARCHAR(150) NOT NULL,
    codigo_est     VARCHAR(9)   NOT NULL UNIQUE,   -- UNIQUE = previene duplicados por código estudiantil
    materia_id     INTEGER      NOT NULL REFERENCES materias(id),
    fecha_registro TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_codigo_formato CHECK (codigo_est ~ '^[0-9]{9}$'),
    CONSTRAINT chk_email_formato  CHECK (email_corp ~* '^[A-Za-z0-9._%+-]+@uptc\.edu\.co$')
);

CREATE INDEX idx_solicitudes_materia ON solicitudes_tutoria(materia_id);

-- Datos iniciales
INSERT INTO materias (nombre) VALUES
    ('Cálculo Diferencial'),
    ('Álgebra Lineal'),
    ('Programación I'),
    ('Programación II'),
    ('Bases de Datos'),
    ('Estructuras de Datos'),
    ('Física Mecánica'),
    ('Redes de Computadores');

INSERT INTO solicitudes_tutoria (nombre, email_corp, codigo_est, materia_id) VALUES
    ('Ana Gómez',   'ana.gomez@uptc.edu.co',   '202011001', 1),
    ('Luis Pérez',  'luis.perez@uptc.edu.co',  '202011002', 5);

-- Verificación
SELECT s.id, s.nombre, s.email_corp, s.codigo_est, m.nombre AS materia, s.fecha_registro
FROM solicitudes_tutoria s
JOIN materias m ON m.id = s.materia_id;
