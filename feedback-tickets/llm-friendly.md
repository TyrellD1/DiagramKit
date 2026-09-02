

## Summary

Want an easy way to build the graph (in text) for llms, whether it's mermaid, etc.

We should be able to do it any any scope (i.e a specific board) or all the boards.

This will require nodes to have a specific pointer to boards, along with other links.

Perhaps this requires some discrimination on node links, as they will have many.

A key link type: child -- may be another board, may link to a dir with open <path> cursor <path> or could be a web link -- but it's important, it's a child not a reference.

Then it can have references.

It's unclear whether we force one child or allow many. On one hand, you may have a web link and a local link, on the other maybe it should be opionated in the spirit of the spatial organization premise.