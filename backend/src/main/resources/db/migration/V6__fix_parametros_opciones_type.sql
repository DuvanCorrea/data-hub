-- ================================================================
-- V6__fix_parametros_opciones_type.sql
-- Cambia columna opciones de JSONB a TEXT para compatibilidad
-- con el binding de Hibernate (String → VARCHAR → TEXT).
-- El contenido JSON se preserva intacto (JSONB::TEXT no pierde datos).
-- ================================================================

ALTER TABLE parametros
    ALTER COLUMN opciones TYPE TEXT USING opciones::TEXT;
