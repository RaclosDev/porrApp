package app.porrapp.service.league;

import app.porrapp.service.notification.PushMessage;
import java.util.Set;

public record PokerNotificationEvent(Set<Long> recipients, PushMessage message) {
}
