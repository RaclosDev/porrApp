import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

public class DeleteBets {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:h2:file:./data/porra-mundial;AUTO_SERVER=TRUE";
        try (Connection conn = DriverManager.getConnection(url, "sa", "")) {
            try (Statement stmt = conn.createStatement()) {
                int rows = stmt.executeUpdate("DELETE FROM bets WHERE participant_name IN ('LaManoDeDios86', 'l', 'LaManoDeDios8')");
                System.out.println("Deleted " + rows + " rows.");
            }
        }
    }
}
