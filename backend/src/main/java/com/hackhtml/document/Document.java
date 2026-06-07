package com.hackhtml.document;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@org.springframework.data.mongodb.core.mapping.Document(collection = "documents")
public class Document {

    @Id
    private String id;

    @Indexed
    private String ownerId;

    private String title;

    private ContentType contentType = ContentType.HTML;

    /** MinIO object key holding the current content (e.g. documents/{id}/v3.md). */
    private String currentVersionKey;

    /** Short plaintext snippet for list views, so we don't fetch MinIO for every card. */
    private String excerpt = "";

    private Visibility visibility = Visibility.PRIVATE;

    /** Random slug used for public/unlisted share links. */
    @Indexed(unique = true, sparse = true)
    private String shareSlug;

    /** Reserved for future real-time collaboration / sharing with specific users. */
    private List<Collaborator> collaborators = new ArrayList<>();

    /** Monotonic content version counter. */
    private int version = 0;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public enum ContentType { HTML, MARKDOWN }
    public enum Visibility { PRIVATE, UNLISTED, PUBLIC }

    public static class Collaborator {
        public enum Role { VIEW, EDIT }
        private String userId;
        private Role role;

        public Collaborator() {}
        public Collaborator(String userId, Role role) { this.userId = userId; this.role = role; }
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public Role getRole() { return role; }
        public void setRole(Role role) { this.role = role; }
    }

    public String fileExtension() {
        return contentType == ContentType.HTML ? "html" : "md";
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public ContentType getContentType() { return contentType; }
    public void setContentType(ContentType contentType) { this.contentType = contentType; }
    public String getCurrentVersionKey() { return currentVersionKey; }
    public void setCurrentVersionKey(String currentVersionKey) { this.currentVersionKey = currentVersionKey; }
    public String getExcerpt() { return excerpt; }
    public void setExcerpt(String excerpt) { this.excerpt = excerpt; }
    public Visibility getVisibility() { return visibility; }
    public void setVisibility(Visibility visibility) { this.visibility = visibility; }
    public String getShareSlug() { return shareSlug; }
    public void setShareSlug(String shareSlug) { this.shareSlug = shareSlug; }
    public List<Collaborator> getCollaborators() { return collaborators; }
    public void setCollaborators(List<Collaborator> collaborators) { this.collaborators = collaborators; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
