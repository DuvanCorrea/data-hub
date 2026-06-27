package com.dropitools.datahub.infrastructure.processor;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Lee un archivo Excel (.xlsx) de Dropi fila a fila usando Apache POI.
 * Retorna cada fila como Map<String, String> con los nombres exactos de las cabeceras.
 * No hace transformaciones ni validaciones de negocio aquí — eso es responsabilidad del processor.
 */
@Component
@Slf4j
public class DropiExcelReader {

    /**
     * Columnas mínimas que DEBEN existir en el Excel para que sea válido.
     * Los nombres deben coincidir exactamente con la cabecera del archivo (insensible a mayúsculas).
     */
    private static final Set<String> REQUIRED_COLUMNS = Set.of(
            "id", "fecha", "nombre cliente", "teléfono",
            "estatus", "total de la orden", "vendedor", "tienda"
    );

    /**
     * Lee todas las filas del Excel y las entrega como Iterable de Maps.
     *
     * @param filePath ruta del archivo en disco
     * @return lista de filas, cada una como Map{cabecera → valor_string}
     * @throws IllegalStateException si faltan columnas obligatorias
     */
    public List<Map<String, String>> readRows(Path filePath) {
        List<Map<String, String>> rows = new ArrayList<>();

        try (InputStream is = Files.newInputStream(filePath);
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);

            if (headerRow == null) {
                throw new IllegalStateException("El archivo Excel está vacío o no tiene encabezados.");
            }

            // Mapear posición de columna → nombre de cabecera
            Map<Integer, String> headerMap = new LinkedHashMap<>();
            for (Cell cell : headerRow) {
                String name = getCellStringValue(cell, null).trim().toLowerCase();
                if (!name.isBlank()) {
                    headerMap.put(cell.getColumnIndex(), name);
                }
            }

            // Validar columnas obligatorias
            Set<String> missing = new HashSet<>(REQUIRED_COLUMNS);
            missing.removeAll(headerMap.values());
            if (!missing.isEmpty()) {
                throw new IllegalStateException(
                        "Columnas obligatorias faltantes en el Excel: " + missing);
            }

            log.debug("Cabeceras detectadas ({}): {}", headerMap.size(), headerMap.values());

            // Leer filas de datos (comenzando desde la fila 1)
            int lastRowNum = sheet.getLastRowNum();
            for (int i = 1; i <= lastRowNum; i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowBlank(row)) {
                    continue;
                }

                Map<String, String> rowData = new LinkedHashMap<>();
                for (Map.Entry<Integer, String> entry : headerMap.entrySet()) {
                    Cell cell = row.getCell(entry.getKey(), Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    rowData.put(entry.getValue(), getCellStringValue(cell, workbook));
                }
                rows.add(rowData);
            }

        } catch (IOException e) {
            throw new RuntimeException("Error al leer el archivo Excel: " + e.getMessage(), e);
        }

        return rows;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Convierte cualquier tipo de celda a String de forma segura.
     * Fechas → formato ISO "yyyy-MM-dd HH:mm:ss"
     * Números → String sin notación científica
     */
    private String getCellStringValue(Cell cell, Workbook workbook) {
        if (cell == null) {
            return "";
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    var localDate = cell.getLocalDateTimeCellValue();
                    yield localDate != null
                            ? localDate.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                            : "";
                }
                // Números: evitar notación científica
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val) && !Double.isInfinite(val)) {
                    yield String.valueOf((long) val);
                }
                yield BigDecimal.valueOf(val).toPlainString();
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue().trim();
                } catch (Exception e) {
                    yield String.valueOf(cell.getNumericCellValue());
                }
            }
            default -> "";
        };
    }

    private boolean isRowBlank(Row row) {
        for (Cell cell : row) {
            if (cell != null && cell.getCellType() != CellType.BLANK) {
                String val = getCellStringValue(cell, null);
                if (!val.isBlank()) {
                    return false;
                }
            }
        }
        return true;
    }
}
