package com.example.company.aicontentcreator.storage;

import com.example.company.aicontentcreator.domain.Story;
import java.util.List;
import java.util.Optional;

public interface StoryRepository {

    List<Story> findAll();

    Optional<Story> findById(Long id);

    Story save(Story story);

    void deleteById(Long id);
}