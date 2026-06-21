package com.porra.mundial.service;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.BetGroup;
import com.porra.mundial.repository.BetGroupRepository;
import com.porra.mundial.repository.BetRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroupService {

    private final BetGroupRepository betGroupRepository;
    private final BetRepository betRepository;

    @Value("${app.admins:Admin}")
    private List<String> appAdmins;

    @PostConstruct
    public void initDefaultGroup() {
        // Create Default Group if not exists
        BetGroup globalGroup = betGroupRepository.findById(1L).orElseGet(() -> {
            BetGroup group = BetGroup.builder()
                    .name("Porra Global")
                    .joinCode("GLOBAL")
                    .adminParticipantName("Admin")
                    .build();
            return betGroupRepository.save(group);
        });

        // Migrate all existing bets to this global group (except the Admin template)
        List<Bet> allBets = betRepository.findAll();
        boolean migrated = false;
        for (Bet bet : allBets) {
            if (bet.getGroupId() == null) {
                if (bet.getParticipantName().equalsIgnoreCase("Admin")) {
                    // Admin bet stays global (null)
                    continue;
                }
                bet.setGroupId(globalGroup.getId());
                betRepository.save(bet);
                migrated = true;
            }
        }
        
        if (migrated) {
            log.info("Migradas las porras existentes al Grupo Global.");
        }
    }

    public BetGroup createGroup(String name, String adminParticipantName) {
        String joinCode;
        do {
            joinCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        } while (betGroupRepository.findByJoinCode(joinCode).isPresent());

        BetGroup group = BetGroup.builder()
                .name(name)
                .joinCode(joinCode)
                .adminParticipantName(adminParticipantName)
                .build();
        return betGroupRepository.save(group);
    }

    public Optional<BetGroup> getGroupByJoinCode(String joinCode) {
        return betGroupRepository.findByJoinCode(joinCode);
    }

    public List<BetGroup> getUserGroups(String participantName) {
        List<Bet> bets = betRepository.findByParticipantName(participantName);
        List<Long> groupIds = bets.stream()
                .map(Bet::getGroupId)
                .filter(id -> id != null)
                .distinct()
                .collect(Collectors.toList());
        
        List<BetGroup> adminGroups = betGroupRepository.findByAdminParticipantName(participantName);
        adminGroups.forEach(g -> {
            if (!groupIds.contains(g.getId())) {
                groupIds.add(g.getId());
            }
        });

        // El Grupo 1 (Porra Global) siempre lo devolvemos para que puedan unirse si no están
        if (!groupIds.contains(1L)) {
            groupIds.add(1L);
        }

        return betGroupRepository.findAllById(groupIds);
    }

    public Optional<BetGroup> getGroupById(Long id) {
        return betGroupRepository.findById(id);
    }

    public void leaveGroup(Long groupId, String participantName) {
        if (groupId == 1L) {
            throw new IllegalArgumentException("No puedes abandonar la Porra Global.");
        }
        BetGroup group = betGroupRepository.findById(groupId)
            .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));

        if (group.getAdminParticipantName().equalsIgnoreCase(participantName)) {
            throw new IllegalArgumentException("El creador de la liga no puede abandonarla.");
        }

        List<Bet> bets = betRepository.findByParticipantName(participantName);
        for (Bet bet : bets) {
            if (bet.getGroupId() != null && bet.getGroupId().equals(groupId)) {
                betRepository.delete(bet);
            }
        }
    }

    private void verifyGroupAdmin(Long groupId, String participantName) {
        BetGroup group = betGroupRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));
                
        boolean isSuperAdmin = appAdmins.stream().anyMatch(admin -> admin.equalsIgnoreCase(participantName));
                               
        if (!isSuperAdmin && !group.getAdminParticipantName().equalsIgnoreCase(participantName)) {
            throw new SecurityException("No tienes permiso para administrar esta liga.");
        }
    }

    public List<Bet> getGroupBetsForAdmin(Long groupId, String participantName) {
        verifyGroupAdmin(groupId, participantName);
        return betRepository.findByGroupId(groupId);
    }

    public Bet toggleBetPaymentStatus(Long groupId, Long betId, String participantName, boolean paid) {
        verifyGroupAdmin(groupId, participantName);
        Bet bet = betRepository.findById(betId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Apuesta no encontrada"));
        if (!groupId.equals(bet.getGroupId())) {
            throw new IllegalArgumentException("La apuesta no pertenece a este grupo");
        }
        bet.setPaid(paid);
        return betRepository.save(bet);
    }

    public void deleteBet(Long groupId, Long betId, String participantName) {
        verifyGroupAdmin(groupId, participantName);
        Bet bet = betRepository.findById(betId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Apuesta no encontrada"));
        if (!groupId.equals(bet.getGroupId())) {
            throw new IllegalArgumentException("La apuesta no pertenece a este grupo");
        }
        betRepository.delete(bet);
    }
}
