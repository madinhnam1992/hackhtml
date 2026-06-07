package com.hackhtml.document;

import com.hackhtml.common.ApiException;
import com.hackhtml.dto.DocumentDtos.CreateRequest;
import com.hackhtml.dto.DocumentDtos.Detail;
import com.hackhtml.dto.DocumentDtos.ShareRequest;
import com.hackhtml.dto.DocumentDtos.Summary;
import com.hackhtml.dto.DocumentDtos.UpdateContentRequest;
import com.hackhtml.dto.DocumentDtos.UpdateMetadataRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @GetMapping
    public List<Summary> list(@AuthenticationPrincipal String userId) {
        requireAuth(userId);
        return service.listOwnedBy(userId).stream().map(Summary::from).toList();
    }

    @PostMapping
    public Detail create(@AuthenticationPrincipal String userId,
                         @Valid @RequestBody CreateRequest req) {
        requireAuth(userId);
        Document doc = service.create(userId, req.title(), req.contentType());
        return Detail.from(doc, "", true);
    }

    @GetMapping("/{id}")
    public Detail get(@AuthenticationPrincipal String userId, @PathVariable String id) {
        requireAuth(userId);
        Document doc = service.getForView(id, userId);
        String content = service.readContent(doc);
        return Detail.from(doc, content, service.canEdit(doc, userId));
    }

    @PutMapping("/{id}/content")
    public Detail updateContent(@AuthenticationPrincipal String userId,
                                @PathVariable String id,
                                @RequestBody UpdateContentRequest req) {
        requireAuth(userId);
        Document doc = service.updateContent(id, userId, req.content());
        return Detail.from(doc, req.content() == null ? "" : req.content(), true);
    }

    @PutMapping("/{id}")
    public Detail updateMetadata(@AuthenticationPrincipal String userId,
                                 @PathVariable String id,
                                 @RequestBody UpdateMetadataRequest req) {
        requireAuth(userId);
        Document doc = service.updateMetadata(id, userId, req.title(), req.visibility());
        return Detail.from(doc, service.readContent(doc), true);
    }

    @PostMapping("/{id}/share")
    public Detail share(@AuthenticationPrincipal String userId,
                        @PathVariable String id,
                        @Valid @RequestBody ShareRequest req) {
        requireAuth(userId);
        Document doc = service.share(id, userId, req.visibility());
        return Detail.from(doc, service.readContent(doc), true);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String userId,
                                       @PathVariable String id) {
        requireAuth(userId);
        service.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    private void requireAuth(String userId) {
        if (userId == null) {
            throw ApiException.unauthorized("Authentication required");
        }
    }
}
