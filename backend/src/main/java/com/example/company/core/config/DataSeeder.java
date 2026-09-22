package com.example.company.core.config;

import com.example.company.core.character.CharacterRecord;
import com.example.company.core.character.CharacterRepository;
import com.example.company.core.auth.PasswordHasher;
import com.example.company.core.domain.EntityType;
import com.example.company.core.domain.LinkKind;
import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;
import com.example.company.core.domain.Role;
import com.example.company.core.domain.StoryType;
import com.example.company.core.domain.SystemRole;
import com.example.company.core.link.LinkRepository;
import com.example.company.core.lore.LoreRepository;
import com.example.company.core.membership.MembershipRepository;
import com.example.company.core.node.NodeFull;
import com.example.company.core.node.NodeRepository;
import com.example.company.core.release.CreateReleaseRequest;
import com.example.company.core.release.ReleaseService;
import com.example.company.core.story.StoryRepository;
import com.example.company.core.user.UserRecord;
import com.example.company.core.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository users;
    private final StoryRepository stories;
    private final MembershipRepository memberships;
    private final NodeRepository nodes;
    private final CharacterRepository characters;
    private final LoreRepository lore;
    private final LinkRepository links;
    private final ReleaseService releases;
    private final PasswordHasher passwords;
    private final JsonMapper mapper;

    public DataSeeder(UserRepository users,
                      StoryRepository stories,
                      MembershipRepository memberships,
                      NodeRepository nodes,
                      CharacterRepository characters,
                      LoreRepository lore,
                      LinkRepository links,
                      ReleaseService releases,
                      PasswordHasher passwords,
                      JsonMapper mapper) {
        this.users = users;
        this.stories = stories;
        this.memberships = memberships;
        this.nodes = nodes;
        this.characters = characters;
        this.lore = lore;
        this.links = links;
        this.releases = releases;
        this.passwords = passwords;
        this.mapper = mapper;
    }

    @Override
    @Transactional
    public void run(String... args) {
        // Accounts created before auth existed have no password; give them the demo password
        // so seeded users are always usable.
        users.backfillMissingPasswords(passwords.encode("storyforge"));

        if (users.findByEmail("alice@example.com").isPresent()) {
            users.findByEmail("alice@example.com")
                    .filter(u -> u.systemRole() != SystemRole.ADMIN)
                    .ifPresent(u -> users.setSystemRole(u.id(), SystemRole.ADMIN));
            log.info("Seed data already present, skipping");
            return;
        }

        UserRecord alice = users.create("alice@example.com", "Alice Alder", passwords.encode("storyforge"));
        users.setSystemRole(alice.id(), SystemRole.ADMIN);
        UserRecord bob = users.create("bob@example.com", "Bob Birch", passwords.encode("storyforge"));
        UserRecord carol = users.create("carol@example.com", "Carol Cedar", passwords.encode("storyforge"));

        long novel = story("The Silent Wood", StoryType.NOVEL, alice.id(), "A coming-of-age mystery set in a village that borders a forest which remembers too much.");
        memberships.upsert(novel, bob.id(), Role.COLLABORATOR);
        memberships.upsert(novel, carol.id(), Role.EDITOR);

        NodeFull book = nodes.insert(novel, null, NodeKind.BOOK, "The Year of Ash", 10, null, NodeStatus.DONE,
                prose("The village was older than its name, and twice as stubborn."), null, null, alice.id());
        NodeFull clearing = nodes.insert(novel, book.id(), NodeKind.CHAPTER, "The Clearing", 10, null, NodeStatus.DONE,
                prose("Elian found the clearing the way you find old wounds: by pressing on them."), null, null, alice.id());
        NodeFull hollow = nodes.insert(novel, book.id(), NodeKind.CHAPTER, "The Hollow Road", 20, null, NodeStatus.DRAFT,
                prose("Past the blackwater stile the road forgot where it was going."), null, null, alice.id());
        nodes.insert(novel, clearing.id(), NodeKind.SCENE, "First Light", 10, null, NodeStatus.DRAFT,
                prose("Mist sat on the glade like an unspoken apology."), null, null, alice.id());

        CharacterRecord elian = characters.insert(novel, "Elian", attributes("age", 24, "role", "woodcutter"),
                "Apprentice woodcutter who hears the trees.", "Afraid of silence since the winter of the ash fall.", alice.id());
        CharacterRecord marrow = characters.insert(novel, "Marrow", attributes("age", null, "role", "the wood"),
                "The forest itself, waking slowly.", "Nods in weather.", alice.id());

        long ash = lore.insert(novel, "The Ash Trees", "World", "The ash grove pre-dates every map that mentions it. Its roots run under the church, the mill, and the mayor's house.", alice.id()).id();
        long greyRoad = lore.insert(novel, "The Grey Road", "Places", "A road that appears on no survey and leads to no town anyone remembers.", alice.id()).id();

        links.insert(novel, EntityType.CHARACTER, elian.id(), EntityType.NODE, clearing.id(), LinkKind.MENTIONS, alice.id());
        links.insert(novel, EntityType.CHARACTER, marrow.id(), EntityType.LORE_ENTRY, ash, LinkKind.REFERENCES, alice.id());
        links.insert(novel, EntityType.NODE, clearing.id(), EntityType.LORE_ENTRY, greyRoad, LinkKind.REFERENCES, alice.id());

        long rpg = story("The Shattered Crown", StoryType.RPG, alice.id(), "The last heir of a broken kingdom hunts the pieces of a crown that makes anyone who wears it remember who they were.");
        memberships.upsert(rpg, bob.id(), Role.COLLABORATOR);

        NodeFull act = nodes.insert(rpg, null, NodeKind.ACT, "The Borderlands", 10, null, NodeStatus.DONE,
                emptyDoc(), null, null, alice.id());
        NodeFull quest1 = nodes.insert(rpg, act.id(), NodeKind.QUEST, "Path of Ashes", 10, null, NodeStatus.DONE,
                prose("Find the first shard in the burned village of Cantrel."), null, null, alice.id());
        NodeFull quest2 = nodes.insert(rpg, act.id(), NodeKind.QUEST, "The Stone Eye", 20, null, NodeStatus.DRAFT,
                prose("The shard as a man remembers it sits at the top of the Stone Eye keep."), null, null, alice.id());
        nodes.insert(rpg, quest1.id(), NodeKind.STEP, "Ask the miller's daughter", 10, null, NodeStatus.DRAFT,
                prose("She saw the crown carried north, wrapped in a flour sack."), null, null, alice.id());
        links.insert(rpg, EntityType.NODE, quest1.id(), EntityType.NODE, quest2.id(), LinkKind.UNLOCKS, alice.id());
        lore.insert(rpg, "The Broken Throne", "History", "The throne cracked on coronation night, which the historians quietly called an accident.", alice.id());
        characters.insert(rpg, "Vex", attributes("age", 31, "role", "mercenary"), "Sells loyalty in lengths.", "Takes payment in promises, then keeps both.", alice.id());

        long script = story("Midnight Diner", StoryType.SCRIPT, alice.id(), "The graveyard shift of a city diner and the strangers who pass through its door.");
        memberships.upsert(script, carol.id(), Role.VIEWER);

        NodeFull episode = nodes.insert(script, null, NodeKind.EPISODE, "Pilot", 10, null, NodeStatus.DONE,
                emptyDoc(), null, null, alice.id());
        CharacterRecord kai = characters.insert(script, "Kai", attributes("age", 28, "role", "line cook"), "Runs the grill after midnight.", "Owns exactly one matching pair of socks.", alice.id());
        JsonNode scriptBody = mapper.createObjectNode()
                .put("sceneHeading", "INT. MIDNIGHT DINER - NIGHT")
                .set("actionLines", mapper.createArrayNode()
                        .add("Rain thrums against the window. A row of ceiling bulbs hums over an empty counter."))
                .set("dialogue", mapper.createArrayNode()
                        .addObject()
                        .put("characterId", kai.id())
                        .put("characterName", kai.name())
                        .put("parenthetical", "(wiping a glass)")
                        .put("line", "You again."));
        nodes.insert(script, episode.id(), NodeKind.SCENE, "Counter at 1 A.M.", 10, null, NodeStatus.DONE,
                emptyDoc(), scriptBody, null, alice.id());

        releases.create(alice.id(), novel, new CreateReleaseRequest("First draft", "Chapters one through the clearing. WIP."));

        log.info("Seeded demo data");
    }

    private long story(String title, StoryType type, long userId, String synopsis) {
        var record = stories.create(title, type, "en", synopsis, null, userId);
        memberships.upsert(record.id(), userId, Role.OWNER);
        return record.id();
    }

    private JsonNode prose(String text) {
        return mapper.createObjectNode()
                .put("type", "doc")
                .putArray("content")
                .addObject()
                .put("type", "paragraph")
                .putArray("content")
                .addObject()
                .put("type", "text")
                .put("text", text);
    }

    private JsonNode emptyDoc() {
        return mapper.createObjectNode()
                .put("type", "doc")
                .putArray("content");
    }

    private JsonNode attributes(Object... pairs) {
        var node = mapper.createObjectNode();
        for (int i = 0; i < pairs.length; i += 2) {
            Object value = pairs[i + 1];
            if (value instanceof Integer number) {
                node.put(String.valueOf(pairs[i]), number);
            } else if (value instanceof String text) {
                node.put(String.valueOf(pairs[i]), text);
            }
        }
        return node;
    }
}