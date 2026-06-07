package com.hackhtml.document;

import com.hackhtml.common.ApiException;
import com.hackhtml.storage.StorageService;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;

@Service
public class DocumentService {

    private static final String SLUG_ALPHABET =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int SLUG_LENGTH = 10;
    private static final int EXCERPT_LENGTH = 200;

    private final DocumentRepository repo;
    private final StorageService storage;
    private final SecureRandom random = new SecureRandom();

    public DocumentService(DocumentRepository repo, StorageService storage) {
        this.repo = repo;
        this.storage = storage;
    }

    public List<Document> listOwnedBy(String userId) {
        return repo.findByOwnerIdOrderByUpdatedAtDesc(userId);
    }

    public Document create(String userId, String title, Document.ContentType contentType) {
        Document doc = new Document();
        doc.setOwnerId(userId);
        doc.setTitle(title == null || title.isBlank() ? "Untitled" : title.trim());
        doc.setContentType(contentType == null ? Document.ContentType.HTML : contentType);
        doc.setVersion(0);
        doc = repo.save(doc); // persist first to obtain id
        String key = objectKey(doc, 0);
        storage.putText(key, "", mimeFor(doc));
        doc.setCurrentVersionKey(key);
        return repo.save(doc);
    }

    public Document getForView(String id, String userId) {
        Document doc = require(id);
        if (!canView(doc, userId)) {
            throw ApiException.forbidden("You do not have access to this document");
        }
        return doc;
    }

    public Document getForEdit(String id, String userId) {
        Document doc = require(id);
        if (!canEdit(doc, userId)) {
            throw ApiException.forbidden("You cannot edit this document");
        }
        return doc;
    }

    public String readContent(Document doc) {
        if (doc.getCurrentVersionKey() == null) {
            return "";
        }
        return storage.getText(doc.getCurrentVersionKey());
    }

    public Document updateContent(String id, String userId, String content) {
        Document doc = getForEdit(id, userId);
        String safeContent = content == null ? "" : content;
        int newVersion = doc.getVersion() + 1;
        String key = objectKey(doc, newVersion);
        storage.putText(key, safeContent, mimeFor(doc));
        doc.setCurrentVersionKey(key);
        doc.setVersion(newVersion);
        doc.setExcerpt(buildExcerpt(safeContent));
        doc.setUpdatedAt(Instant.now());
        return repo.save(doc);
    }

    public Document updateMetadata(String id, String userId, String title, Document.Visibility visibility) {
        Document doc = getForEdit(id, userId);
        if (title != null && !title.isBlank()) {
            doc.setTitle(title.trim());
        }
        if (visibility != null) {
            applyVisibility(doc, visibility);
        }
        doc.setUpdatedAt(Instant.now());
        return repo.save(doc);
    }

    public Document share(String id, String userId, Document.Visibility visibility) {
        Document doc = getForEdit(id, userId);
        applyVisibility(doc, visibility);
        doc.setUpdatedAt(Instant.now());
        return repo.save(doc);
    }

    public void delete(String id, String userId) {
        Document doc = require(id);
        if (!doc.getOwnerId().equals(userId)) {
            throw ApiException.forbidden("Only the owner can delete this document");
        }
        repo.delete(doc);
        // Best-effort cleanup of stored versions.
        for (int v = 0; v <= doc.getVersion(); v++) {
            storage.delete(objectKey(doc, v));
        }
    }

    public Document getPublicBySlug(String slug) {
        Document doc = repo.findByShareSlug(slug)
                .orElseThrow(() -> ApiException.notFound("Shared document not found"));
        if (doc.getVisibility() == Document.Visibility.PRIVATE) {
            throw ApiException.notFound("Shared document not found");
        }
        return doc;
    }

    // --- permissions ---

    public boolean canView(Document doc, String userId) {
        if (doc.getVisibility() != Document.Visibility.PRIVATE) {
            return true;
        }
        return isOwnerOrCollaborator(doc, userId);
    }

    public boolean canEdit(Document doc, String userId) {
        if (userId == null) {
            return false; // anonymous users can only view public docs (read-only)
        }
        if (doc.getOwnerId().equals(userId)) {
            return true;
        }
        // Shared/public docs are editable by any authenticated user.
        if (doc.getVisibility() != Document.Visibility.PRIVATE) {
            return true;
        }
        return doc.getCollaborators().stream()
                .anyMatch(c -> c.getUserId().equals(userId)
                        && c.getRole() == Document.Collaborator.Role.EDIT);
    }

    private boolean isOwnerOrCollaborator(Document doc, String userId) {
        if (userId == null) {
            return false;
        }
        return doc.getOwnerId().equals(userId)
                || doc.getCollaborators().stream().anyMatch(c -> c.getUserId().equals(userId));
    }

    // --- helpers ---

    private void applyVisibility(Document doc, Document.Visibility visibility) {
        doc.setVisibility(visibility);
        if (visibility == Document.Visibility.PRIVATE) {
            doc.setShareSlug(null);
        } else if (doc.getShareSlug() == null) {
            doc.setShareSlug(generateUniqueSlug());
        }
    }

    private Document require(String id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Document not found"));
    }

    private String objectKey(Document doc, int version) {
        return "documents/" + doc.getId() + "/v" + version + "." + doc.fileExtension();
    }

    private String mimeFor(Document doc) {
        return doc.getContentType() == Document.ContentType.HTML
                ? "text/html" : "text/markdown";
    }

    private String buildExcerpt(String content) {
        String text = content.replaceAll("<[^>]+>", " ")   // drop html tags
                .replaceAll("[#>*`_~\\-]", " ")               // drop common md markers
                .replaceAll("\\s+", " ")
                .trim();
        return text.length() > EXCERPT_LENGTH ? text.substring(0, EXCERPT_LENGTH) : text;
    }

    private String generateUniqueSlug() {
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder sb = new StringBuilder(SLUG_LENGTH);
            for (int i = 0; i < SLUG_LENGTH; i++) {
                sb.append(SLUG_ALPHABET.charAt(random.nextInt(SLUG_ALPHABET.length())));
            }
            String slug = sb.toString();
            if (repo.findByShareSlug(slug).isEmpty()) {
                return slug;
            }
        }
        throw ApiException.conflict("Could not generate a unique share link, please retry");
    }
}
