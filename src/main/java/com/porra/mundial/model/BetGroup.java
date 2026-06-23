package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "leagues")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BetGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true, length = 10)
    private String joinCode;

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "admin_user_id", nullable = false)
    private UserAccount adminUser;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Transient
    public String getAdminParticipantName() {
        return adminUser != null ? adminUser.getParticipantName() : null;
    }

    @Transient
    public void setAdminParticipantName(String name) {
        // Ignored by JPA, needed for builders temporarily
    }

    @com.fasterxml.jackson.annotation.JsonProperty("adminUserId")
    @Transient
    public Long getAdminUserId() {
        return adminUser != null ? adminUser.getId() : null;
    }
}
