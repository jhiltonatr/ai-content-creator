package com.example.company.core.extraction;

import java.util.List;
import tools.jackson.databind.JsonNode;

public record ExtractionRequest(JsonNode doc, List<String> types) {}