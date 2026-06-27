package com.dropitools.datahub.infrastructure.persistence.repository;

import com.dropitools.datahub.infrastructure.persistence.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByTenantIdAndUsername(Long tenantId, String username);
    Optional<UserEntity> findByUsername(String username);
}
