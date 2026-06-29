package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.ParametroEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParametroRepository extends JpaRepository<ParametroEntity, Long> {
    Optional<ParametroEntity> findByClave(String clave);
    List<ParametroEntity> findAllByOrderByAplicacionAscOrdenAsc();
}
