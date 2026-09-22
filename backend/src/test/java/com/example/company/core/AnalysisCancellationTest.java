package com.example.company.core;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.company.core.analysis.AnalysisAbortedException;
import com.example.company.core.analysis.AnalysisProperties;
import com.example.company.core.analysis.LlamaAnalysisClient;
import com.example.company.core.analysis.ProseAnalysisRequest;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
class AnalysisCancellationTest {

    @Autowired
    private JsonMapper mapper;

    @Test
    void abortCancelsAnInflightRequest() throws Exception {
        ExecutorService serverPool = Executors.newCachedThreadPool();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            try {
                Thread.sleep(30_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            try {
                exchange.sendResponseHeaders(503, -1);
            } catch (Exception ignored) {
                // Client already aborted the connection.
            }
            exchange.close();
        });
        server.setExecutor(serverPool);
        server.start();
        try {
            AnalysisProperties props = new AnalysisProperties();
            props.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            props.setTimeoutMs(60_000);
            LlamaAnalysisClient client = new LlamaAnalysisClient(props, mapper);

            ProseAnalysisRequest request = new ProseAnalysisRequest(
                    1, 1, "NOVEL", "en", List.of(), List.of(), List.of("The the wind."));

            AtomicBoolean abort = new AtomicBoolean();
            AtomicReference<Throwable> thrown = new AtomicReference<>();
            Thread worker = new Thread(() -> {
                try {
                    client.analyze(request, abort);
                } catch (Throwable e) {
                    thrown.set(e);
                }
            });

            worker.start();
            Thread.sleep(300);
            abort.set(true);
            worker.join(5000);

            assertThat(worker.isAlive()).isFalse();
            assertThat(thrown.get()).isInstanceOf(AnalysisAbortedException.class);
        } finally {
            serverPool.shutdownNow();
            server.stop(0);
        }
    }
}