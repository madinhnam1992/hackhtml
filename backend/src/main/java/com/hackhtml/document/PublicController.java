package com.hackhtml.document;

import com.hackhtml.dto.DocumentDtos.Detail;
import com.hackhtml.dto.DocumentDtos.PdfRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Unauthenticated read-only access to shared documents. */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final DocumentService service;
    private final PdfService pdfService;

    public PublicController(DocumentService service, PdfService pdfService) {
        this.service = service;
        this.pdfService = pdfService;
    }

    @GetMapping("/{slug}")
    public Detail getShared(@PathVariable String slug) {
        Document doc = service.getPublicBySlug(slug);
        String content = service.readContent(doc);
        return Detail.from(doc, content, false);
    }

    @PostMapping("/{slug}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable String slug, @RequestBody PdfRequest req) {
        service.getPublicBySlug(slug); // only render PDFs for a real shared document
        return pdfService.renderResponse(req.html(), req.title());
    }
}
