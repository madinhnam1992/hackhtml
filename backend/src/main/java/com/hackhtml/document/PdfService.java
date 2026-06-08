package com.hackhtml.document;

import com.hackhtml.common.ApiException;
import com.hackhtml.config.AppProperties;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.Margin;
import com.microsoft.playwright.options.WaitUntilState;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Single choke point for headless-Chromium PDF rendering (mirrors the role of
 * {@code StorageService} for MinIO). The frontend ships the already-rendered, print-ready HTML
 * and we turn it into a PDF with a page-number footer that the browser print dialog can't give us.
 *
 * <p>Playwright objects must be used on the thread that created them, so each pooled renderer owns
 * a single-thread executor that holds its own {@link Playwright}/{@link Browser}. A bounded queue
 * hands renderers out one at a time, which also caps concurrency (anti-abuse).
 */
@Service
public class PdfService {

    private static final Logger log = LoggerFactory.getLogger(PdfService.class);

    /** Centered "page / total". Header/footer templates need inline styles to render. */
    private static final String FOOTER_TEMPLATE =
            "<div style=\"font-size:10px;width:100%;text-align:center;color:#666;\">"
            + "<span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>";

    private final AppProperties.Pdf config;
    private BlockingQueue<Renderer> pool;
    private List<Renderer> renderers;

    public PdfService(AppProperties props) {
        this.config = props.getPdf();
    }

    @PostConstruct
    void start() {
        if (!config.isEnabled()) {
            log.info("PDF rendering is disabled (app.pdf.enabled=false)");
            return;
        }
        int size = Math.max(1, config.getPoolSize());
        renderers = new ArrayList<>(size);
        pool = new ArrayBlockingQueue<>(size);
        for (int i = 0; i < size; i++) {
            Renderer r = new Renderer(i, config.getTimeoutMs());
            renderers.add(r);
            pool.add(r);
        }
        log.info("PDF rendering enabled with {} Chromium renderer(s)", size);
    }

    @PreDestroy
    void stop() {
        if (renderers != null) {
            renderers.forEach(Renderer::close);
        }
    }

    /**
     * Render print-ready HTML to a PDF byte array. Blocks briefly for a free renderer.
     *
     * @throws ApiException 503 if disabled or all renderers are busy, 400 if the payload is too big.
     */
    public byte[] render(String html) {
        if (!config.isEnabled() || pool == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PDF rendering is not available");
        }
        String safeHtml = html == null ? "" : html;
        if (safeHtml.getBytes(StandardCharsets.UTF_8).length > config.getMaxHtmlBytes()) {
            throw ApiException.badRequest("Document is too large to export to PDF");
        }

        Renderer renderer;
        try {
            renderer = pool.poll(config.getTimeoutMs(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PDF rendering was interrupted");
        }
        if (renderer == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PDF renderer is busy, please retry");
        }
        try {
            return renderer.render(safeHtml);
        } finally {
            pool.add(renderer);
        }
    }

    /** Render {@code html} and wrap it as a {@code application/pdf} attachment download. */
    public ResponseEntity<byte[]> renderResponse(String html, String title) {
        byte[] pdf = render(html);
        String disposition = ContentDisposition.attachment()
                .filename(safeFilename(title), StandardCharsets.UTF_8)
                .build()
                .toString();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .body(pdf);
    }

    /** A renderer pinned to one thread that owns its Playwright/Browser. */
    private static final class Renderer {
        private final ExecutorService exec;
        private final long timeoutMs;
        private Playwright playwright; // created lazily on the worker thread
        private Browser browser;

        Renderer(int index, long timeoutMs) {
            this.timeoutMs = timeoutMs;
            this.exec = Executors.newSingleThreadExecutor(runnable -> {
                Thread t = new Thread(runnable, "pdf-renderer-" + index);
                t.setDaemon(true);
                return t;
            });
        }

        byte[] render(String html) {
            try {
                // Give the worker a little headroom over the in-page timeout.
                return exec.submit(() -> renderOnWorker(html)).get(timeoutMs + 10_000, TimeUnit.MILLISECONDS);
            } catch (TimeoutException e) {
                throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "PDF rendering timed out");
            } catch (ExecutionException e) {
                Throwable cause = e.getCause();
                if (cause instanceof ApiException api) {
                    throw api;
                }
                log.warn("PDF rendering failed", cause);
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to render PDF");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PDF rendering was interrupted");
            }
        }

        /** Runs on the renderer's own thread, satisfying Playwright's thread-affinity rule. */
        private byte[] renderOnWorker(String html) {
            ensureBrowser();
            BrowserContext context = browser.newContext();
            try {
                // Block subresource requests to private/internal addresses (SSRF guard).
                context.route("**/*", route -> {
                    if (isAllowed(route.request().url())) {
                        route.resume();
                    } else {
                        route.abort();
                    }
                });
                Page page = context.newPage();
                page.setContent(html, new Page.SetContentOptions()
                        .setWaitUntil(WaitUntilState.NETWORKIDLE)
                        .setTimeout(timeoutMs));
                return page.pdf(new Page.PdfOptions()
                        .setFormat("A4")
                        .setPrintBackground(true)
                        .setDisplayHeaderFooter(true)
                        .setHeaderTemplate("<span></span>")
                        .setFooterTemplate(FOOTER_TEMPLATE)
                        .setMargin(new Margin()
                                .setTop("12mm").setBottom("18mm")
                                .setLeft("12mm").setRight("12mm")));
            } finally {
                context.close();
            }
        }

        private void ensureBrowser() {
            if (browser == null) {
                playwright = Playwright.create();
                browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
            }
        }

        void close() {
            try {
                exec.submit(() -> {
                    if (browser != null) browser.close();
                    if (playwright != null) playwright.close();
                }).get(30, TimeUnit.SECONDS);
            } catch (Exception e) {
                log.warn("Failed to close PDF renderer cleanly", e);
            } finally {
                exec.shutdownNow();
            }
        }
    }

    /** Sanitize a document title into a safe {@code <name>.pdf} download filename. */
    public static String safeFilename(String title) {
        String base = (title == null || title.isBlank()) ? "document" : title.trim();
        base = base.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        if (base.length() > 100) base = base.substring(0, 100);
        return base + ".pdf";
    }

    /** Allow data/blob URLs and any public host; block loopback/private/link-local targets. */
    private static boolean isAllowed(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null) return false;
            scheme = scheme.toLowerCase();
            if (scheme.equals("data") || scheme.equals("blob") || scheme.equals("about")) {
                return true;
            }
            if (!scheme.equals("http") && !scheme.equals("https")) {
                return false;
            }
            String host = uri.getHost();
            if (host == null) return false;
            for (InetAddress addr : InetAddress.getAllByName(host)) {
                if (addr.isLoopbackAddress() || addr.isAnyLocalAddress()
                        || addr.isLinkLocalAddress() || addr.isSiteLocalAddress()) {
                    return false;
                }
            }
            return true;
        } catch (Exception e) {
            // Unresolvable or malformed → don't fetch it.
            return false;
        }
    }
}
