package com.dropitools.datahub.application;

import com.dropitools.datahub.domain.model.User;
import com.dropitools.datahub.infrastructure.persistence.entity.UserEntity;
import com.dropitools.datahub.infrastructure.persistence.repository.UserRepository;
import com.dropitools.datahub.infrastructure.security.JwtProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    @Override
    public Optional<String> authenticate(String username, String password) {
        Optional<UserEntity> userOpt = userRepository.findByUsername(username);

        if (userOpt.isPresent()) {
            UserEntity user = userOpt.get();
            if (user.getIsActive() && passwordEncoder.matches(password, user.getPassword())) {
                log.info("{\"action\":\"LOGIN\",\"tenantId\":{},\"userId\":{},\"result\":\"SUCCESS\"}", user.getTenantId(), user.getId());
                return Optional.of(jwtProvider.generateToken(user.getTenantId(), user.getId(), user.getRole()));
            }
        }
        
        log.info("{\"action\":\"LOGIN\",\"username\":\"{}\",\"result\":\"FAILED\"}", username);
        return Optional.empty();
    }

    @Override
    public Optional<User> getCurrentUser(Long tenantId, Long userId) {
        return userRepository.findById(userId)
                .filter(u -> u.getTenantId().equals(tenantId) && u.getIsActive())
                .map(u -> User.builder()
                        .id(u.getId())
                        .tenantId(u.getTenantId())
                        .username(u.getUsername())
                        .role(u.getRole())
                        .isActive(u.getIsActive())
                        .createdAt(u.getCreatedAt())
                        .build());
    }
}
