package com.dropitools.datahub.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;

@Entity
@Table(name = "producto_variaciones")
@Getter @Setter
public class ProductoVariacionEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id",        nullable = false) private Long   tenantId;
    @Column(name = "producto_id",      nullable = false) private Long   productoId;
    @Column(name = "variacion_id_dropi", length = 100)   private String variacionIdDropi;
    @Column(name = "nombre_variacion",   length = 500)   private String nombreVariacion;

    @Column(name = "created_at", nullable = false, updatable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false)                    private OffsetDateTime updatedAt;

    @PrePersist protected void onCreate() { createdAt = updatedAt = OffsetDateTime.now(); }
    @PreUpdate  protected void onUpdate() { updatedAt = OffsetDateTime.now(); }
}
