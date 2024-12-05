import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.json.JSONArray;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

public class ServerRedirector {
    private static final String LOGIN_URL = "http://mes.alphaess.com:8000/api/Account/Login";
    private static final String GET_SYSTEMS_URL = "http://mes.alphaess.com:8000/api/ESS/GetSystems";
    private static final String SEND_COMMAND_URL = "http://mes.alphaess.com:8000/api/ESSMainTain/ActualESSCmdModel";
    private static final String USERNAME = "RD_inverter";
    private static final String PASSWORD = "1234";
    private static final String SN_LIST_FILE = "snlist.csv";

    public static void main(String[] args) {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

        scheduler.scheduleAtFixedRate(() -> {
            try {
                executeMainLogic();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }, 0, 4, TimeUnit.HOURS);
    }

    private static void executeMainLogic() {
        try {
            System.out.println("Executing main logic at " + new Date());
            String token = login();
            List<String> onlineSystems = getSystems(token);
            List<String> snList = readSnList();
            List<String> systemsToUpdate = new ArrayList<>(onlineSystems);
            systemsToUpdate.retainAll(snList);

            for (String sn : systemsToUpdate) {
                sendCommand(token, sn);
                TimeUnit.SECONDS.sleep(2);
            }

            System.out.println("Updated " + systemsToUpdate.size() + " systems");
        } catch (Exception e) {
            System.err.println("Error in main logic execution: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static String login() throws Exception {
        JSONObject requestBody = new JSONObject();
        requestBody.put("username", USERNAME);
        requestBody.put("password", PASSWORD);

        JSONObject response = sendRequest(LOGIN_URL, "POST", requestBody.toString(), null);
        if (response.getInt("code") != 200) {
            throw new Exception("Login failed: " + response.toString());
        }
        return response.getJSONObject("data").getString("AccessToken");
    }

    private static List<String> getSystems(String token) throws Exception {
        String[] states = {"normal", "protection", "fault"};
        
        List<CompletableFuture<List<String>>> futures = Arrays.stream(states)
            .map(state -> CompletableFuture.supplyAsync(() -> getSystemsForState(state, token)))
            .collect(Collectors.toList());

        CompletableFuture<Void> allOf = CompletableFuture.allOf(
            futures.toArray(new CompletableFuture[0])
        );

        return allOf.thenApply(v -> 
            futures.stream()
                .map(CompletableFuture::join)
                .flatMap(List::stream)
                .collect(Collectors.toList())
        ).get();
    }

    private static List<String> getSystemsForState(String state, String token) {
        try {
            JSONObject requestBody = new JSONObject();
            requestBody.put("sortBy", "registrationtime");
            requestBody.put("searchBy", "sn");
            requestBody.put("state", state);
            requestBody.put("keyword", "");
            requestBody.put("pageIndex", 1);
            requestBody.put("pageSize", 1000);

            JSONObject response = sendRequest(GET_SYSTEMS_URL, "POST", requestBody.toString(), token);
            if (response.has("error")) {
                System.err.println("Error response for state " + state + ": " + response.toString());
                return Collections.emptyList();
            }
            if (response.getInt("code") != 200) {
                System.err.println("Failed to get systems for state " + state + ": " + response.toString());
                return Collections.emptyList();
            }

            List<String> systems = new ArrayList<>();
            if (!response.isNull("data")) {
                Object dataObj = response.get("data");
                if (dataObj instanceof JSONObject) {
                    JSONObject dataJson = (JSONObject) dataObj;
                    if (dataJson.has("data") && dataJson.get("data") instanceof JSONArray) {
                        JSONArray dataArray = dataJson.getJSONArray("data");
                        for (int i = 0; i < dataArray.length(); i++) {
                            systems.add(dataArray.getJSONObject(i).getString("sys_sn"));
                        }
                    }
                } else if (dataObj instanceof JSONArray) {
                    JSONArray dataArray = (JSONArray) dataObj;
                    for (int i = 0; i < dataArray.length(); i++) {
                        systems.add(dataArray.getJSONObject(i).getString("sys_sn"));
                    }
                }
            } else {
                System.out.println("No data returned for state: " + state);
            }

            System.out.println("Retrieved " + systems.size() + " systems for state: " + state);
            return systems;
        } catch (Exception e) {
            System.err.println("Error getting systems for state " + state + ": " + e.getMessage());
            e.printStackTrace();
            return Collections.emptyList();
        }
    }

    private static void sendCommand(String token, String sn) throws Exception {
        JSONObject requestBody = new JSONObject();
        requestBody.put("sys_sn", sn);
        requestBody.put("cmd_code", "Extra");
        requestBody.put("language_code", "zh-CN");
        requestBody.put("start_time", "4");
        requestBody.put("remark", "6");

        JSONObject response = sendRequest(SEND_COMMAND_URL, "POST", requestBody.toString(), token);
        if (response.has("error")) {
            throw new Exception("Failed to send command for SN " + sn + ": " + response.toString());
        }
        if (response.getInt("code") != 200) {
            throw new Exception("Failed to send command for SN " + sn + ": " + response.toString());
        }
        System.out.println("Command sent successfully for SN: " + sn);
    }

    private static JSONObject sendRequest(String urlString, String method, String body, String token) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
            if (token != null) {
                conn.setRequestProperty("Authorization", "Bearer " + token);
            }
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = body.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            if (responseCode >= 400) {
                System.err.println("HTTP Error: " + responseCode + " for URL: " + urlString);
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String responseLine;
                    while ((responseLine = br.readLine()) != null) {
                        response.append(responseLine.trim());
                    }
                    System.err.println("Error response: " + response.toString());
                }
                return new JSONObject().put("code", responseCode).put("error", "HTTP Error");
            }

            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder response = new StringBuilder();
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }
                return new JSONObject(response.toString());
            }
        } catch (Exception e) {
            System.err.println("Error in sendRequest for URL " + urlString + ": " + e.getMessage());
            e.printStackTrace();
            return new JSONObject().put("code", 500).put("error", "Internal Error");
        }
    }

    private static List<String> readSnList() throws IOException {
        List<String> snList = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new FileReader(SN_LIST_FILE))) {
            String line;
            while ((line = br.readLine()) != null) {
                snList.add(line.trim());
            }
        }
        return snList;
    }
}
