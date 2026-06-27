package com.dropitools.datahub.application;

import com.dropitools.datahub.domain.model.User;

import java.util.Optional;

public interface AuthService {
    /**
     * Autentica un usuario y devuelve un JWT si es exitoso.
     * @param username el nombre de usuario
     * @param password la contraseña sin encriptar
     * @return un JWT como String si la autenticación es exitosa, de lo contrario un Optional vacío
     */
    Optional<String> authenticate(String username, String password);

    /**
     * Obtiene los datos del usuario autenticado.
     * @param tenantId el ID del tenant
     * @param userId el ID del usuario
     * @return el objeto User si se encuentra, de lo contrario un Optional vacío
     */
    Optional<User> getCurrentUser(Long tenantId, Long userId);
}
