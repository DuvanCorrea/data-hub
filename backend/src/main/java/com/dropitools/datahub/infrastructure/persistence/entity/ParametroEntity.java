package com.dropitools.datahub.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;

@Entity
@Table(name = "parametros")
@Getter @Setter
public class ParametroEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "aplicacion", nullable = false, length = 40)
    private String aplicacion;

    @Column(name = "clave", nullable = false, length = 100, unique = true)
    private String clave;

    @Column(name = "etiqueta", nullable = false)
    private String etiqueta;

    @Column(name = "descripcion", columnDefinition = "TEXT")
    private String descripcion;

    @Column(name = "tipo_dato", nullable = false, length = 20)
    private String tipoDato;   // STRING | NUMBER | BOOLEAN | SELECT

    @Column(name = "valor", nullable = false, columnDefinition = "TEXT")
    private String valor;

    @Column(name = "valor_defecto", nullable = false, columnDefinition = "TEXT")
    private String valorDefecto;

    // JSONB almacenado como String — [{valor,etiqueta}]
    @Column(name = "opciones", columnDefinition = "JSONB")
    private String opciones;

    @Column(name = "es_editable", nullable = false)
    private Boolean esEditable = true;

    @Column(name = "orden", nullable = false)
    private Integer orden = 0;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @PrePersist @PreUpdate
    protected void onUpdate() { updatedAt = OffsetDateTime.now(); }
}
