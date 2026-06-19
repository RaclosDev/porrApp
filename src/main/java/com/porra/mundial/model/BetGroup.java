package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bet_groups")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BetGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true, length = 10)
    private String joinCode;

    @Column(nullable = false)
    private String adminParticipantName;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
