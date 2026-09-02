

# Summary

## Types of links:

### Child:

Could be:
- cursor <path>
- open <path>
- url
- link to another board in atreides (must be a short link /<board-id> or whatever)

### Reference links

Should have a name as well as link

### Sanitization

The options should be hardcoded, not generic cli commands.

We should have an option for cursor and open, that's it for now.

Build in such a way that it's expandable.

### High Level goal

To be clear each node can have many links, but for now only one child link -- which is a special link that will be triggered on a generic node click (a button in the top right corner for now)

Then there will be reference links, if exist they should be listed on the bottom of the node.

It's important all these link buttons (both the child and other) prevent propogation when clicked (on the node)