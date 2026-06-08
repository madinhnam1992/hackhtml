package com.hackhtml.dto;

import com.hackhtml.document.Document;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class DocumentDtos {

    private DocumentDtos() {}

    public record CreateRequest(String title, @NotNull Document.ContentType contentType) {}

    public record UpdateMetadataRequest(String title, Document.Visibility visibility) {}

    public record UpdateContentRequest(String content) {}

    public record ShareRequest(@NotNull Document.Visibility visibility) {}

    /** Print-ready HTML (rendered by the frontend) to turn into a PDF, plus a suggested filename. */
    public record PdfRequest(String html, String title) {}

    /** Lightweight projection for list views (no MinIO fetch). */
    public record Summary(
            String id, String title, Document.ContentType contentType,
            Document.Visibility visibility, String shareSlug, String excerpt,
            int version, Instant updatedAt) {
        public static Summary from(Document d) {
            return new Summary(d.getId(), d.getTitle(), d.getContentType(), d.getVisibility(),
                    d.getShareSlug(), d.getExcerpt(), d.getVersion(), d.getUpdatedAt());
        }
    }

    /** Full metadata + content, returned for the editor and public viewer. */
    public record Detail(
            String id, String title, Document.ContentType contentType,
            Document.Visibility visibility, String shareSlug, String content,
            int version, boolean editable, Instant createdAt, Instant updatedAt) {
        public static Detail from(Document d, String content, boolean editable) {
            return new Detail(d.getId(), d.getTitle(), d.getContentType(), d.getVisibility(),
                    d.getShareSlug(), content, d.getVersion(), editable,
                    d.getCreatedAt(), d.getUpdatedAt());
        }
    }
}
