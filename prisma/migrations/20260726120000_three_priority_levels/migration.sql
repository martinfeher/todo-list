-- Remove legacy fourth priority level (app now uses three priority colors)
DELETE FROM "TaskTag" WHERE "tagId" = 'tag-priority-4';
DELETE FROM "Tag" WHERE "slug" = 'priority-4';
