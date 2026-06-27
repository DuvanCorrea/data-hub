package com.dropitools.datahub.domain.port;

import com.dropitools.datahub.domain.model.ImportJob;

import java.nio.file.Path;

/**
 * Puerto de dominio: contrato que debe cumplir cada procesador de plantilla.
 *
 * Implementaciones en infrastructure/processor:
 *   - DropiOrderProcessor (template = "DROPI_ORDER")
 *
 * Para agregar un nuevo origen (Shopify, WooCommerce…) solo se crea
 * una nueva clase que implemente esta interfaz — sin tocar el scheduler.
 */
public interface ImportProcessor {

    /** Retorna true si este procesador maneja la plantilla dada. */
    boolean supports(String template);

    /**
     * Fase 1: leer el Excel fila a fila y cargar en stg_dropi_order.
     * Actualiza import_job.rows_total al terminar.
     */
    void loadToStaging(ImportJob job, Path filePath);

    /**
     * Fase 2: procesar cada fila de staging con UPSERT en pedidos.
     * Actualiza import_job.rows_done en tiempo real.
     */
    void processStaging(ImportJob job);
}
