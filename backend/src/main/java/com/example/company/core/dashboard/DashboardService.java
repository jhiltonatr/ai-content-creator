package com.example.company.core.dashboard;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.domain.NodeStatus;
import com.example.company.core.story.StoryRecord;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DashboardService {

    private static final int RECENT_EDIT_LIMIT = 8;

    private final DashboardRepository dashboard;
    private final StoryRepository stories;
    private final AccessChecker access;

    public DashboardService(DashboardRepository dashboard, StoryRepository stories, AccessChecker access) {
        this.dashboard = dashboard;
        this.stories = stories;
        this.access = access;
    }

    public DashboardResponse get(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        StoryRecord story = stories.require(storyId);

        List<DashboardNode> nodes = dashboard.listForStory(storyId, story.defaultLanguage());

        Map<Long, NodeRollup> rollups = new HashMap<>();
        for (DashboardNode node : nodes) {
            rollups.put(node.id(), new NodeRollup());
        }
        List<DashboardNode> roots = new ArrayList<>();
        for (DashboardNode node : nodes) {
            NodeRollup rollup = rollups.get(node.id());
            rollup.childCount = 1;                      // counts the node itself
            rollup.wordCount = node.wordCount();
            if (node.status() == NodeStatus.DONE) {
                rollup.doneCount = 1;
            } else {
                rollup.draftCount = 1;
            }
            if (node.parentId() != null && rollups.containsKey(node.parentId())) {
                rollups.get(node.parentId()).children.add(node);
            } else {
                roots.add(node);
            }
        }

        // Fold every child's totals into its parent; post-order so grandchildren land first.
        for (DashboardNode root : roots) {
            accumulate(rollups, root.id());
        }

        long totalWords = 0;
        long nodeCount = 0;
        long draftCount = 0;
        long doneCount = 0;
        Map<String, Long> languageCounts = new HashMap<>();
        List<BookSummary> books = new ArrayList<>();

        for (DashboardNode node : nodes) {
            languageCounts.merge(node.language(), 1L, Long::sum);
        }
        for (DashboardNode root : roots) {
            NodeRollup rollup = rollups.get(root.id());
            books.add(new BookSummary(root, rollup.wordCount, rollup.childCount,
                    rollup.draftCount, rollup.doneCount, subtree(rollups, root.id())));
            totalWords += rollup.wordCount;
            nodeCount += rollup.childCount;
            draftCount += rollup.draftCount;
            doneCount += rollup.doneCount;
        }

        List<LanguageCount> languages = languageCounts.entrySet().stream()
                .map(e -> new LanguageCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(LanguageCount::count).reversed().thenComparing(LanguageCount::code))
                .toList();

        List<DashboardNode> recentEdits = nodes.stream()
                .sorted((a, b) -> {
                    int byTime = b.updatedAt().compareTo(a.updatedAt());
                    return byTime != 0 ? byTime : Long.compare(b.id(), a.id());
                })
                .limit(RECENT_EDIT_LIMIT)
                .toList();

        return new DashboardResponse(story.id(), story.title(), story.storyType(), story.defaultLanguage(),
                story.synopsis(), story.updatedAt(), totalWords, nodeCount, draftCount, doneCount,
                languages, books, recentEdits);
    }

    /**
     * Adds the aggregated totals of every child into the ancestor's rollup. Called
     * once per node after per-node counters are seeded, so totals only include
     * descendants — the node itself is already counted in its own rollup.
     */
    private static void accumulate(Map<Long, NodeRollup> rollups, long nodeId) {
        NodeRollup rollup = rollups.get(nodeId);
        for (DashboardNode child : rollup.children) {
            accumulate(rollups, child.id());
            NodeRollup childRollup = rollups.get(child.id());
            rollup.wordCount += childRollup.wordCount;
            rollup.childCount += childRollup.childCount;
            rollup.draftCount += childRollup.draftCount;
            rollup.doneCount += childRollup.doneCount;
        }
    }

    /**
     * The full subtree of {@code nodeId} (every descendant, not the node itself) in
     * tree order — the listing the overview renders per book.
     */
    private static List<DashboardNode> subtree(Map<Long, NodeRollup> rollups, long nodeId) {
        List<DashboardNode> out = new ArrayList<>();
        for (DashboardNode child : rollups.get(nodeId).children) {
            out.add(child);
            out.addAll(subtree(rollups, child.id()));
        }
        return out;
    }

    private static final class NodeRollup {
        final List<DashboardNode> children = new ArrayList<>();
        long wordCount;
        long childCount;
        long draftCount;
        long doneCount;

        NodeRollup() {
        }
    }
}