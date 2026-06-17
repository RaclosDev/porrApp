import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class ListBets {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:h2:file:./data/porra-mundial;AUTO_SERVER=TRUE";
        try (Connection conn = DriverManager.getConnection(url, "sa", "")) {
            try (Statement stmt = conn.createStatement()) {
                ResultSet rs = stmt.executeQuery("SELECT participant_name FROM bets");
                while (rs.next()) {
                    System.out.println("Name: '" + rs.getString("participant_name") + "'");
                }
            }
        }
    }
}
