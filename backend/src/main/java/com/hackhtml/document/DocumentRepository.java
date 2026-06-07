package com.hackhtml.document;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends MongoRepository<Document, String> {
    List<Document> findByOwnerIdOrderByUpdatedAtDesc(String ownerId);
    Optional<Document> findByShareSlug(String shareSlug);
}
