package com.dropitools.datahub.application;

import com.dropitools.datahub.infrastructure.persistence.entity.ParametroEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.ParametroRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Servicio de parámetros de configuración global.
 *
 * Caché: al arrancar carga todos los valores en un ConcurrentHashMap.
 * Al actualizar un parámetro, el caché se invalida inmediatamente.
 * Así los processors leen de memoria (0 ms) sin golpear la BD en cada lote.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ParametroService {

    private final ParametroRepository repo;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadCache() {
        repo.findAll().forEach(p -> cache.put(p.getClave(), p.getValor()));
        log.info("{\"action\":\"PARAMETROS_CACHE_LOADED\",\"count\":{}}", cache.size());
    }

    // ── Getters tipados ────────────────────────────────────────────────────────

    public String getString(String clave, String defaultValue) {
        return cache.getOrDefault(clave, defaultValue);
    }

    public int getInt(String clave, int defaultValue) {
        try {
            String v = cache.get(clave);
            return v != null ? Integer.parseInt(v.trim()) : defaultValue;
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public boolean getBoolean(String clave, boolean defaultValue) {
        String v = cache.get(clave);
        return v != null ? Boolean.parseBoolean(v.trim()) : defaultValue;
    }

    // ── Constantes de clave ────────────────────────────────────────────────────
    // Evita magic strings dispersos en el código.

    public static final String IMPORT_BATCH_SIZE       = "IMPORT_BATCH_SIZE";
    public static final String IMPORT_MAX_FILE_MB      = "IMPORT_MAX_FILE_MB";
    public static final String JOBS_ORPHAN_TIMEOUT_MIN = "JOBS_ORPHAN_TIMEOUT_MIN";
    public static final String EXPORT_MAX_ROWS         = "EXPORT_MAX_ROWS";
    public static final String DASHBOARD_RANGO_DIAS    = "DASHBOARD_RANGO_DIAS";
    public static final String DROPI_MONEDA            = "DROPI_MONEDA";

    // ── Helpers de negocio ─────────────────────────────────────────────────────

    /**
     * Tamaño de lote para procesamiento.
     * 0 = sin lotes (todo de una vez → Integer.MAX_VALUE internamente).
     */
    public int getBatchSize() {
        int v = getInt(IMPORT_BATCH_SIZE, 0);
        return v <= 0 ? Integer.MAX_VALUE : v;
    }

    public int getMaxFileMb()          { return getInt(IMPORT_MAX_FILE_MB,      50);    }
    public int getOrphanTimeoutMin()   { return getInt(JOBS_ORPHAN_TIMEOUT_MIN, 10);    }
    public int getExportMaxRows()      { return getInt(EXPORT_MAX_ROWS,         10000); }
    public int getDashboardRangoDias() { return getInt(DASHBOARD_RANGO_DIAS,    7);     }
    public String getMoneda()          { return getString(DROPI_MONEDA,         "COP"); }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    public List<ParametroEntity> listAll() {
        return repo.findAllByOrderByAplicacionAscOrdenAsc();
    }

    @Transactional
    public ParametroEntity update(String clave, String nuevoValor, Long updatedBy) {
        ParametroEntity p = repo.findByClave(clave)
                .orElseThrow(() -> new IllegalArgumentException("Parámetro no encontrado: " + clave));

        if (!p.getEsEditable()) {
            throw new IllegalStateException("El parámetro '" + clave + "' no es editable.");
        }

        // Validar valor si es tipo SELECT
        if ("SELECT".equalsIgnoreCase(p.getTipoDato()) && p.getOpciones() != null) {
            boolean valido = p.getOpciones().contains("\"" + nuevoValor + "\"");
            if (!valido) {
                throw new IllegalArgumentException(
                        "Valor '" + nuevoValor + "' no está en las opciones permitidas para " + clave);
            }
        }

        // Validar tipo NUMBER
        if ("NUMBER".equalsIgnoreCase(p.getTipoDato())) {
            try { Integer.parseInt(nuevoValor.trim()); }
            catch (NumberFormatException e) {
                throw new IllegalArgumentException("El valor debe ser un número entero.");
            }
        }

        p.setValor(nuevoValor.trim());
        p.setUpdatedBy(updatedBy);
        ParametroEntity saved = repo.save(p);

        // Invalidar caché inmediatamente
        cache.put(clave, nuevoValor.trim());
        log.info("{\"action\":\"PARAMETRO_UPDATED\",\"clave\":\"{}\",\"valor\":\"{}\"}", clave, nuevoValor);
        return saved;
    }

    @Transactional
    public ParametroEntity reset(String clave, Long updatedBy) {
        ParametroEntity p = repo.findByClave(clave)
                .orElseThrow(() -> new IllegalArgumentException("Parámetro no encontrado: " + clave));
        return update(clave, p.getValorDefecto(), updatedBy);
    }

    @Transactional
    public void resetAll(Long updatedBy) {
        repo.findAll().forEach(p -> {
            if (Boolean.TRUE.equals(p.getEsEditable())) {
                p.setValor(p.getValorDefecto());
                p.setUpdatedBy(updatedBy);
                cache.put(p.getClave(), p.getValorDefecto());
            }
        });
        repo.findAll().forEach(p -> {
            if (Boolean.TRUE.equals(p.getEsEditable())) repo.save(p);
        });
        log.info("{\"action\":\"PARAMETROS_RESET_ALL\",\"updatedBy\":{}}", updatedBy);
    }
}
