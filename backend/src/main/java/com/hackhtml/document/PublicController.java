package com.hackhtml.document;

import com.hackhtml.dto.DocumentDtos.Detail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Unauthenticated read-only access to shared documents. */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final DocumentService service;

    public PublicController(DocumentService service) {
        this.service = service;
    }

    @GetMapping("/{slug}")
    public Detail getShared(@PathVariable String slug) {
        Document doc = service.getPublicBySlug(slug);
        String content = service.readContent(doc);
        return Detail.from(doc, content, false);
    }
}
