package com.example.company.core.node;

import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;

import java.util.List;

public record NodeSummary(long id,
                          NodeKind kind,
                          String title,
                          NodeStatus status,
                          int sortOrder,
                          List<NodeSummary> children) {
}